"""Shared DRF pagination classes."""
from rest_framework.pagination import PageNumberPagination


class DefaultPagination(PageNumberPagination):
    """PageNumberPagination that lets the client override page size via ?page_size=."""

    page_size_query_param = 'page_size'
    max_page_size = 200
