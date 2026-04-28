"""
Custom permissions for ALZ Nota Futura.

Contains role-based permissions for internal users.
Permission classes are scaffolded here — apply them to views as features are built.
"""

from django.conf import settings
from rest_framework import permissions


class IsInternalStaff(permissions.BasePermission):
    """Permission to check if user is internal ALZ staff."""

    message = "You must be internal staff to perform this action."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.is_internal_staff
        )


class IsComercial(permissions.BasePermission):
    """Permission for COMERCIAL role (sales team)."""

    message = "You must have COMERCIAL role to perform this action."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if not request.user.is_internal_staff:
            return False
        return request.user.internal_roles.filter(role='COMERCIAL', is_active=True).exists()


class IsLogistics(permissions.BasePermission):
    """Permission for LOGISTICS role."""

    message = "You must have LOGISTICS role to perform this action."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if not request.user.is_internal_staff:
            return False
        return request.user.internal_roles.filter(role='LOGISTICS', is_active=True).exists()


class IsFiscal(permissions.BasePermission):
    """Permission for FISCAL role."""

    message = "You must have FISCAL role to perform this action."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if not request.user.is_internal_staff:
            return False
        return request.user.internal_roles.filter(role='FISCAL', is_active=True).exists()


class IsSystemAdmin(permissions.BasePermission):
    """Permission for ADMIN role (system administrators)."""

    message = "You must be a system administrator to perform this action."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        if request.user.is_internal_staff:
            return request.user.internal_roles.filter(role='ADMIN', is_active=True).exists()
        return False


class HasRPAToken(permissions.BasePermission):
    """Allow machine-to-machine access from the RPA via a shared secret.

    The RPA must send the token in the ``X-RPA-Token`` HTTP header on
    every callback. The expected value comes from ``settings.RPA_API_TOKEN``.
    """

    message = "RPA token ausente ou inválido."

    def has_permission(self, request, view):
        expected = getattr(settings, 'RPA_API_TOKEN', None)
        if not expected:
            return False
        provided = request.META.get('HTTP_X_RPA_TOKEN', '')
        return bool(provided) and provided == expected
