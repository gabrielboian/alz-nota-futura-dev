"""Business-logic services for the orders domain."""
from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from .models import LoadingOrder, SalesOrder


def revise_sales_order(
    ov: SalesOrder,
    changes: dict,
    user=None,
    keep_loading_order_ids: set | None = None,
) -> SalesOrder:
    """Invalidate *ov*, create a revised copy and return it.

    This is the canonical way to edit an OV. The old row is set to
    ``INVALIDATED`` (not deleted) so the RPA can still see its history.

    OC split rules
    --------------
    - OCs in ``keep_loading_order_ids`` move to the new OV.
    - OCs NOT selected stay on the old (invalidated) OV — they are never
      deactivated.
    - New OV balance  = sum of weight_kg of selected (kept) OCs.
      If no OCs are selected the new OV balance = old OV balance.
    - Old OV balance  = sum of weight_kg of remaining (not-kept) active OCs.
      If no OCs remain its balance is set to 0.
    - total_quantity_kg of new OV = new balance + delivered_quantity_kg of old OV.

    Args:
        ov: The current (live) SalesOrder to supersede.
        changes: Dict of field -> new value to apply to the new row.
        user: The user performing the revision (stored in ``invalidated_by``).
        keep_loading_order_ids: OC IDs to move to the new OV.

    Returns:
        The newly created SalesOrder revision.

    Raises:
        ValueError: If *ov* is already INVALIDATED or CLOSED.
    """
    if ov.ov_status in (SalesOrder.Status.INVALIDATED, SalesOrder.Status.CLOSED):
        raise ValueError(
            f'Não é possível revisar uma OV com status "{ov.get_ov_status_display()}".'
        )

    keep_ids: set = set(keep_loading_order_ids or [])
    root_order = ov.original_order or ov

    with transaction.atomic():
        all_active_ocs = list(
            LoadingOrder.objects.filter(
                sales_order=ov,
                status=LoadingOrder.Status.ACTIVE,
            )
        )

        kept_ocs = [o for o in all_active_ocs if o.pk in keep_ids]
        remaining_ocs = [o for o in all_active_ocs if o.pk not in keep_ids]

        delivered = ov.delivered_quantity_kg or Decimal('0')

        if kept_ocs:
            new_balance = sum((o.weight_kg or Decimal('0')) for o in kept_ocs)
        else:
            # No OCs selected — carry full balance to new OV
            new_balance = ov.balance_kg or Decimal('0')

        new_total = new_balance + delivered

        # Old OV balance = sum of remaining OCs (those staying behind)
        old_remaining_balance = sum(
            (o.weight_kg or Decimal('0')) for o in remaining_ocs
        ) if remaining_ocs else Decimal('0')

        # 1. Build the new revision
        new_ov = SalesOrder(
            managed_lot=ov.managed_lot,
            original_order=root_order,
            order_index=ov.order_index + 1,
            ov_status=SalesOrder.Status.PENDING,
            rpa_status=SalesOrder.RpaStatus.AWAITING_OV_CREATION,
            harvest_year=ov.harvest_year,
            product_sap_code=ov.product_sap_code,
            alternative_route=ov.alternative_route,
            corridor=ov.corridor,
            collection_point_code=ov.collection_point_code,
            freight_agent=ov.freight_agent,
            freight_type_exit=ov.freight_type_exit,
            cadence=ov.cadence,
            total_quantity_kg=new_total,
            balance_kg=new_balance,
            delivered_quantity_kg=delivered,
            billing_branch=ov.billing_branch,
            transshipment_location=ov.transshipment_location,
            terminal_destination=ov.terminal_destination,
            rfl_value_kg=ov.rfl_value_kg,
            freight_value=ov.freight_value,
            billing_producer_name=ov.billing_producer_name,
            client_state_registration=ov.client_state_registration,
            nf_future_delivery=ov.nf_future_delivery,
            manually_created=ov.manually_created,
        )

        # 2. Apply caller-supplied changes
        for attr, value in changes.items():
            setattr(new_ov, attr, value)

        new_ov.save()

        # 3. Move kept OCs to the new OV (remaining OCs stay on old OV as-is)
        if keep_ids:
            LoadingOrder.objects.filter(sales_order=ov, pk__in=keep_ids).update(
                sales_order=new_ov
            )

        # 4. Update old OV balance to reflect only its remaining OCs, then invalidate
        ov.balance_kg = old_remaining_balance
        ov.ov_status = SalesOrder.Status.INVALIDATED
        ov.invalidated_at = timezone.now()
        ov.invalidated_by = user
        ov.save(update_fields=[
            'balance_kg', 'ov_status', 'invalidated_at', 'invalidated_by', 'updated_at',
        ])

    return new_ov
