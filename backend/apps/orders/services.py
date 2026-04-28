"""Business-logic services for the orders domain."""
from __future__ import annotations

from django.db import transaction
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

    Args:
        ov: The current (live) SalesOrder to supersede.
        changes: Dict of field -> new value to apply to the new row.
        user: The user performing the revision (stored in ``invalidated_by``).
        keep_loading_order_ids: OC IDs to move from the old OV to the new one.
            All other OCs on the old OV are marked INACTIVE.

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
        # 1. Build the new revision, copying all carried fields from the old OV
        new_ov = SalesOrder(
            managed_lot=ov.managed_lot,
            original_order=root_order,
            order_index=ov.order_index + 1,
            ov_status=SalesOrder.Status.PENDING,
            rpa_status=SalesOrder.RpaStatus.AWAITING_OV_CREATION,
            # carry over all business fields
            harvest_year=ov.harvest_year,
            product_sap_code=ov.product_sap_code,
            alternative_route=ov.alternative_route,
            corridor=ov.corridor,
            collection_point_code=ov.collection_point_code,
            freight_agent=ov.freight_agent,
            freight_type_exit=ov.freight_type_exit,
            cadence=ov.cadence,
            total_quantity_kg=ov.balance_kg,
            balance_kg=ov.balance_kg,
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

        # 3. Deactivate OCs not being carried over
        LoadingOrder.objects.filter(sales_order=ov).exclude(
            pk__in=keep_ids
        ).update(status=LoadingOrder.Status.INACTIVE)

        # 4. Move kept OCs to the new OV
        if keep_ids:
            LoadingOrder.objects.filter(sales_order=ov, pk__in=keep_ids).update(
                sales_order=new_ov
            )

        # 5. Invalidate the old OV
        ov.ov_status = SalesOrder.Status.INVALIDATED
        ov.invalidated_at = timezone.now()
        ov.invalidated_by = user
        ov.save(update_fields=['ov_status', 'invalidated_at', 'invalidated_by', 'updated_at'])

    return new_ov
