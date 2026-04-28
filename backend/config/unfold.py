"""
Django Unfold Admin Theme Configuration — ALZ Nota Futura.
"""

UNFOLD = {
    "SITE_TITLE": "ALZ Nota Futura",
    "SITE_HEADER": "ALZ — Nota de Entrega Futura",
    "SITE_URL": "/",
    "SITE_ICON": None,
    "SITE_LOGO": None,
    "SITE_SYMBOL": "📦",

    "COLORS": {
        "primary": {
            "50":  "235 242 248",
            "100": "207 225 239",
            "200": "160 198 224",
            "300": "112 170 208",
            "400": "65  143 193",
            "500": "24  67  103",   # #184367 — ALZ brand blue
            "600": "20  56  87",
            "700": "16  45  70",
            "800": "12  34  53",
            "900": "10  27  57",    # #0A1B39
            "950": "6   16  34",
        },
    },

    "SIDEBAR": {
        "show_search": True,
        "show_all_applications": False,
        "navigation": [
            {
                "title": "Painel",
                "separator": False,
                "items": [
                    {
                        "title": "Início",
                        "icon": "home",
                        "link": "/admin/",
                    },
                ],
            },
            {
                "title": "Usuários e Acesso",
                "separator": True,
                "collapsible": True,
                "items": [
                    {
                        "title": "Usuários",
                        "icon": "person",
                        "link": "/admin/authentication/customuser/",
                    },
                    {
                        "title": "Perfis Internos",
                        "icon": "badge",
                        "link": "/admin/authentication/internaluserrole/",
                    },
                ],
            },
            {
                "title": "Contratos e Lotes",
                "separator": True,
                "collapsible": True,
                "items": [
                    {
                        "title": "Uploads de Contrato",
                        "icon": "upload_file",
                        "link": "/admin/contracts/contractupload/",
                    },
                    {
                        "title": "Lotes Base",
                        "icon": "inventory_2",
                        "link": "/admin/contracts/contractbaselot/",
                    },
                    {
                        "title": "Lotes Gerenciados",
                        "icon": "inventory",
                        "link": "/admin/contracts/contractmanagedlot/",
                    },
                ],
            },
            {
                "title": "Embarques",
                "separator": True,
                "collapsible": True,
                "items": [
                    {
                        "title": "Solicitações de Embarque",
                        "icon": "local_shipping",
                        "link": "/admin/shipments/shipmentrequest/",
                    },
                ],
            },
            {
                "title": "Ordens",
                "separator": True,
                "collapsible": True,
                "items": [
                    {
                        "title": "Ordens de Venda (OV)",
                        "icon": "receipt_long",
                        "link": "/admin/orders/salesorder/",
                    },
                    {
                        "title": "Ordens de Carregamento (OC)",
                        "icon": "assignment",
                        "link": "/admin/orders/loadingorder/",
                    },
                ],
            },
            {
                "title": "Fiscal",
                "separator": True,
                "collapsible": True,
                "items": [
                    {
                        "title": "NF Entrega Futura",
                        "icon": "description",
                        "link": "/admin/invoices/nffuturedelivery/",
                    },
                    {
                        "title": "Instruções Fiscais",
                        "icon": "gavel",
                        "link": "/admin/fiscal/fiscalinstruction/",
                    },
                ],
            },
            {
                "title": "Cadastros",
                "separator": True,
                "collapsible": True,
                "items": [
                    {
                        "title": "Filiais",
                        "icon": "apartment",
                        "link": "/admin/core/branch/",
                    },
                    {
                        "title": "Terminais Destino",
                        "icon": "warehouse",
                        "link": "/admin/core/terminaldestination/",
                    },
                    {
                        "title": "Locais de Transbordo",
                        "icon": "swap_horiz",
                        "link": "/admin/core/transshipmentlocation/",
                    },
                    {
                        "title": "Participantes",
                        "icon": "group",
                        "link": "/admin/core/participant/",
                    },
                    {
                        "title": "Responsáveis Comerciais",
                        "icon": "support_agent",
                        "link": "/admin/core/commercialresponsible/",
                    },
                    {
                        "title": "Corredores",
                        "icon": "alt_route",
                        "link": "/admin/core/corridor/",
                    },
                    {
                        "title": "Tipos de Frete Saída",
                        "icon": "local_offer",
                        "link": "/admin/core/tipofretsaida/",
                    },
                    {
                        "title": "Transportadoras",
                        "icon": "local_shipping",
                        "link": "/admin/core/transportadora/",
                    },
                    {
                        "title": "Transportadoras ALZT",
                        "icon": "directions_bus",
                        "link": "/admin/core/transportadoraalzt/",
                    },
                ],
            },
            {
                "title": "Integrações RPA",
                "separator": True,
                "collapsible": True,
                "items": [
                    {
                        "title": "Tarefas RPA",
                        "icon": "smart_toy",
                        "link": "/admin/rpa_dispatch/rpadispatchtask/",
                    },
                ],
            },
        ],
    },

    "ENVIRONMENT": "development",
    "SHOW_HISTORY": True,
    "SHOW_VIEW_ON_SITE": False,
    "DASHBOARD_CALLBACK": None,

    "LOGIN": {
        "image": None,
        "redirect_after": "/admin/",
    },

    "TABS": [],
}
