/**
 * The rules the demo's Adminium plays, as `manifest.json` declares them.
 * Written by `npm run demo-rules`; do not edit by hand.
 */
// prettier-ignore
export const MANIFEST_RULES = {
  "stamps": {
    "slot_pauses": {
      "paused_by": {
        "set": "user-name",
        "on": [
          "create",
          {
            "column": "active",
            "values": [
              true
            ]
          }
        ]
      },
      "paused_at": {
        "set": "now",
        "on": [
          "create",
          {
            "column": "active",
            "values": [
              true
            ]
          }
        ]
      }
    },
    "customers": {
      "created_at": {
        "set": "now",
        "on": "create"
      }
    },
    "orders": {
      "placed_at": {
        "set": "now",
        "on": "create"
      },
      "confirmed_at": {
        "set": "now",
        "on": {
          "column": "status",
          "values": [
            "confirmed"
          ]
        },
        "clearOnBack": true
      },
      "confirmed_by": {
        "set": "user-name",
        "on": {
          "column": "status",
          "values": [
            "confirmed"
          ]
        },
        "clearOnBack": true
      },
      "preparing_at": {
        "set": "now",
        "on": {
          "column": "status",
          "values": [
            "preparing"
          ]
        },
        "clearOnBack": true
      },
      "ready_at": {
        "set": "now",
        "on": {
          "column": "status",
          "values": [
            "ready"
          ]
        },
        "clearOnBack": true
      },
      "ready_by": {
        "set": "user-name",
        "on": {
          "column": "status",
          "values": [
            "ready"
          ]
        },
        "clearOnBack": true
      },
      "picked_up_at": {
        "set": "now",
        "on": {
          "column": "status",
          "values": [
            "picked_up"
          ]
        },
        "clearOnBack": true
      },
      "picked_up_by": {
        "set": "user-name",
        "on": {
          "column": "status",
          "values": [
            "picked_up"
          ]
        },
        "clearOnBack": true
      },
      "cancelled_at": {
        "set": "now",
        "on": {
          "column": "status",
          "values": [
            "cancelled"
          ]
        }
      },
      "cancelled_by": {
        "set": {
          "byOrigin": {
            "public": "customer",
            "staff": "user-name"
          }
        },
        "on": {
          "column": "status",
          "values": [
            "cancelled"
          ]
        }
      },
      "not_collected_at": {
        "set": "now",
        "on": {
          "column": "status",
          "values": [
            "not_collected"
          ]
        }
      },
      "link_expires": {
        "set": {
          "moment": {
            "column": "pickup_at",
            "plus": {
              "days": 30
            }
          }
        },
        "on": {
          "columns": [
            "pickup_at"
          ]
        }
      }
    },
    "enquiries": {
      "handled_by": {
        "set": "user-name",
        "on": {
          "column": "status",
          "values": [
            "called",
            "booked",
            "declined"
          ]
        }
      },
      "created_at": {
        "set": "now",
        "on": "create"
      }
    },
    "messages": {
      "created_at": {
        "set": "now",
        "on": "create"
      }
    }
  },
  "enums": {
    "settings": {},
    "menu_categories": {},
    "menu_items": {},
    "modifier_groups": {
      "kind": [
        "radio",
        "check"
      ]
    },
    "modifiers": {},
    "hours": {
      "weekday": [
        "mon",
        "tue",
        "wed",
        "thu",
        "fri",
        "sat",
        "sun"
      ]
    },
    "closures": {},
    "slot_pauses": {},
    "customers": {},
    "orders": {
      "status": [
        "placed",
        "confirmed",
        "preparing",
        "ready",
        "picked_up",
        "cancelled",
        "not_collected"
      ],
      "channel": [
        "online",
        "phone"
      ],
      "paid_method": [
        "cash",
        "card"
      ],
      "cancel_code": [
        "ran_out",
        "too_busy",
        "customer_asked",
        "closed",
        "other",
        "self"
      ]
    },
    "order_items": {},
    "order_item_modifiers": {},
    "enquiries": {
      "status": [
        "new",
        "called",
        "booked",
        "declined"
      ]
    },
    "messages": {
      "kind": [
        "order-confirmation",
        "order-confirmation-phone",
        "order-ready",
        "order-cancelled-ran-out",
        "order-cancelled-too-busy",
        "order-cancelled-customer-asked",
        "order-cancelled-closed",
        "order-cancelled-other",
        "order-cancelled-by-you",
        "order-receipt",
        "enquiry-received"
      ],
      "status": [
        "queued",
        "sent",
        "failed",
        "skipped"
      ],
      "skip_reason": [
        "overtaken",
        "paid",
        "void",
        "no-longer-needed",
        "by-hand"
      ]
    }
  },
  "validation": {
    "settings": {
      "phone": {
        "format": "phone"
      },
      "tax_rate": {
        "min": 0,
        "max": 100
      },
      "slot_minutes": {
        "min": 5,
        "max": 120
      },
      "slot_capacity": {
        "min": 1,
        "max": 200
      },
      "lead_minutes": {
        "min": 0,
        "max": 720
      },
      "preorder_days": {
        "min": 0,
        "max": 14
      },
      "prep_minutes": {
        "min": 0,
        "max": 240
      },
      "max_items": {
        "min": 1,
        "max": 200
      },
      "first_order_number": {
        "min": 1
      }
    },
    "menu_items": {
      "stock_today": {
        "min": 0
      }
    },
    "customers": {
      "email": {
        "format": "email"
      }
    },
    "orders": {
      "phone": {
        "format": "phone"
      },
      "email": {
        "format": "email"
      }
    },
    "order_items": {
      "qty": {
        "min": 1,
        "max": 20
      }
    },
    "enquiries": {
      "heads": {
        "min": 6,
        "max": 120
      },
      "phone": {
        "format": "phone"
      },
      "email": {
        "format": "email"
      }
    }
  },
  "formats": {
    "orders": {
      "number": {
        "from": "number_seq"
      }
    },
    "enquiries": {
      "ref": {
        "from": "ref_seq",
        "prefix": "LG-",
        "pad": 4
      }
    }
  },
  "features": [
    {
      "id": "receipts",
      "requires": [
        "invoices"
      ]
    },
    {
      "id": "holiday-closures",
      "requires": [
        "holiday-calendars"
      ]
    }
  ],
  "capacity": {
    "orders": {
      "kind": "slot",
      "slot": "pickup_at",
      "amount": 1,
      "perSlot": {
        "table": "settings",
        "column": "slot_capacity"
      },
      "slotMinutes": {
        "table": "settings",
        "column": "slot_minutes"
      },
      "countWhere": {
        "column": "status",
        "values": [
          "placed",
          "confirmed",
          "preparing",
          "ready",
          "picked_up"
        ]
      },
      "hours": {
        "table": "hours",
        "weekday": "weekday",
        "open": "open",
        "opens": "opens",
        "closes": "closes"
      },
      "closures": {
        "table": "closures",
        "from": "from_date",
        "to": "to_date",
        "active": "active"
      },
      "pauses": {
        "table": "slot_pauses",
        "slot": "slot_at",
        "active": "active"
      },
      "noticeMinutes": {
        "table": "settings",
        "column": "lead_minutes"
      },
      "windowDays": {
        "table": "settings",
        "column": "preorder_days"
      }
    },
    "order_items": {
      "kind": "parent",
      "via": "menu_item_id",
      "size": {
        "column": "stock_today",
        "onDay": "stock_on"
      },
      "amount": "qty",
      "day": {
        "column": "pickup_at",
        "via": "order_id"
      },
      "countWhere": {
        "column": "status",
        "values": [
          "placed",
          "confirmed",
          "preparing",
          "ready",
          "picked_up"
        ],
        "via": "order_id"
      }
    }
  },
  "states": {
    "orders": {
      "column": "status",
      "initial": "placed",
      "strict": true,
      "moves": {
        "placed": [
          "confirmed",
          {
            "to": "cancelled",
            "requires": {
              "where": [
                {
                  "column": "cancel_code",
                  "isNull": false
                }
              ]
            }
          }
        ],
        "confirmed": [
          "preparing",
          {
            "to": "cancelled",
            "requires": {
              "where": [
                {
                  "column": "cancel_code",
                  "isNull": false
                }
              ]
            }
          },
          {
            "to": "placed",
            "roles": [
              "kitchen",
              "manager"
            ],
            "undo": true,
            "requires": {
              "time": {
                "before": {
                  "column": "confirmed_at",
                  "plus": {
                    "minutes": 1
                  }
                }
              }
            }
          }
        ],
        "preparing": [
          "ready",
          {
            "to": "cancelled",
            "requires": {
              "where": [
                {
                  "column": "cancel_code",
                  "isNull": false
                }
              ]
            }
          },
          {
            "to": "confirmed",
            "roles": [
              "kitchen",
              "manager"
            ],
            "undo": true,
            "requires": {
              "time": {
                "before": {
                  "column": "preparing_at",
                  "plus": {
                    "minutes": 1
                  }
                }
              }
            }
          }
        ],
        "ready": [
          {
            "to": "picked_up",
            "requires": {
              "where": [
                {
                  "column": "paid_method",
                  "isNull": false
                }
              ]
            }
          },
          {
            "to": "cancelled",
            "requires": {
              "where": [
                {
                  "column": "cancel_code",
                  "isNull": false
                }
              ]
            }
          },
          {
            "to": "not_collected",
            "roles": [
              "manager"
            ]
          },
          {
            "to": "preparing",
            "roles": [
              "kitchen",
              "manager"
            ],
            "undo": true,
            "requires": {
              "time": {
                "before": {
                  "column": "ready_at",
                  "plus": {
                    "minutes": 1
                  }
                }
              }
            }
          }
        ],
        "picked_up": [
          {
            "to": "ready",
            "roles": [
              "manager"
            ],
            "undo": true,
            "clears": [
              "paid_method"
            ]
          }
        ]
      },
      "lock": {
        "when": [
          "picked_up",
          "cancelled",
          "not_collected"
        ],
        "except": [
          "link_stopped"
        ]
      },
      "children": {
        "order_items": {
          "via": "order_id",
          "lock": true
        }
      },
      "timed": [
        {
          "from": "ready",
          "to": "not_collected",
          "at": {
            "column": "pickup_at",
            "time": {
              "hours": {
                "table": "hours",
                "weekday": "weekday",
                "open": "open",
                "closes": "closes"
              },
              "edge": "closes"
            }
          }
        },
        {
          "from": "placed",
          "to": "cancelled",
          "at": {
            "column": "pickup_at",
            "time": {
              "hours": {
                "table": "hours",
                "weekday": "weekday",
                "open": "open",
                "closes": "closes"
              },
              "edge": "closes"
            },
            "plus": {
              "minutes": 30
            }
          },
          "set": {
            "cancel_code": "closed"
          }
        },
        {
          "from": "confirmed",
          "to": "cancelled",
          "at": {
            "column": "pickup_at",
            "time": {
              "hours": {
                "table": "hours",
                "weekday": "weekday",
                "open": "open",
                "closes": "closes"
              },
              "edge": "closes"
            },
            "plus": {
              "minutes": 30
            }
          },
          "set": {
            "cancel_code": "closed"
          }
        },
        {
          "from": "preparing",
          "to": "cancelled",
          "at": {
            "column": "pickup_at",
            "time": {
              "hours": {
                "table": "hours",
                "weekday": "weekday",
                "open": "open",
                "closes": "closes"
              },
              "edge": "closes"
            },
            "plus": {
              "minutes": 30
            }
          },
          "set": {
            "cancel_code": "closed"
          }
        }
      ]
    },
    "enquiries": {
      "column": "status",
      "initial": "new",
      "moves": {
        "new": [
          "called",
          "booked",
          "declined"
        ],
        "called": [
          "booked",
          "declined"
        ]
      }
    }
  },
  "publicAccess": [
    {
      "table": "customers",
      "methods": [
        "GET",
        "PATCH"
      ],
      "select": [
        "name",
        "email"
      ],
      "writable": [
        "name"
      ],
      "claim": {
        "verify": "email-link",
        "email": "email"
      },
      "humanCheck": true,
      "forget": {
        "columns": [
          "email",
          "name"
        ],
        "stamp": "forgotten_at",
        "links": true
      }
    },
    {
      "table": "orders",
      "methods": [
        "GET",
        "PATCH"
      ],
      "level": "verified",
      "claimedBy": {
        "table": "customers",
        "column": "customer_id"
      },
      "select": [
        "id",
        "number",
        "status",
        "channel",
        "pickup_at",
        "name",
        "phone",
        "email",
        "note",
        "item_count",
        "subtotal",
        "tax_rate",
        "tax",
        "total",
        "paid_method",
        "cancel_code",
        "cancel_dish",
        "cancel_note",
        "placed_at",
        "confirmed_at",
        "preparing_at",
        "ready_at",
        "picked_up_at",
        "cancelled_at",
        "not_collected_at",
        "link_expires"
      ],
      "writable": [
        "status"
      ],
      "writableValues": {
        "status": [
          "cancelled"
        ]
      },
      "writableWhen": {
        "status": [
          "placed"
        ]
      },
      "defaults": {
        "cancel_code": "self"
      }
    },
    {
      "table": "order_items",
      "methods": [
        "GET"
      ],
      "level": "verified",
      "visibleWith": {
        "table": "orders",
        "via": "order_id"
      },
      "select": [
        "id",
        "order_id",
        "position",
        "menu_item_id",
        "qty",
        "note",
        "name",
        "unit_price",
        "options_total",
        "unit_total",
        "line_total"
      ]
    },
    {
      "table": "order_item_modifiers",
      "methods": [
        "GET"
      ],
      "level": "verified",
      "visibleWith": {
        "table": "order_items",
        "via": "order_item_id"
      },
      "select": [
        "id",
        "order_item_id",
        "modifier_id",
        "name",
        "price_delta"
      ]
    },
    {
      "table": "orders",
      "kind": "availability",
      "methods": [
        "GET"
      ]
    },
    {
      "table": "order_items",
      "kind": "availability",
      "methods": [
        "GET"
      ],
      "showLeft": {
        "below": 5
      }
    },
    {
      "table": "menu_categories",
      "methods": [
        "GET"
      ],
      "select": [
        "id",
        "slug",
        "name",
        "position",
        "icon",
        "tint"
      ]
    },
    {
      "table": "menu_items",
      "methods": [
        "GET"
      ],
      "select": [
        "id",
        "category_id",
        "slug",
        "name",
        "description",
        "price",
        "image",
        "featured",
        "tags",
        "position",
        "hue",
        "allergens"
      ],
      "filters": [
        {
          "column": "available",
          "op": "eq",
          "value": true
        },
        {
          "column": "online",
          "op": "eq",
          "value": true
        }
      ],
      "pictures": [
        "image"
      ]
    },
    {
      "table": "modifier_groups",
      "methods": [
        "GET"
      ],
      "select": [
        "id",
        "item_id",
        "slug",
        "name",
        "kind",
        "min",
        "max",
        "hint",
        "position"
      ]
    },
    {
      "table": "modifiers",
      "methods": [
        "GET"
      ],
      "select": [
        "id",
        "group_id",
        "slug",
        "name",
        "price_delta",
        "position",
        "allergens"
      ],
      "filters": [
        {
          "column": "available",
          "op": "eq",
          "value": true
        }
      ]
    },
    {
      "table": "hours",
      "methods": [
        "GET"
      ],
      "select": [
        "id",
        "weekday",
        "open",
        "opens",
        "closes"
      ]
    },
    {
      "table": "closures",
      "methods": [
        "GET"
      ],
      "select": [
        "id",
        "from_date",
        "to_date",
        "reason"
      ],
      "filters": [
        {
          "column": "active",
          "op": "eq",
          "value": true
        },
        {
          "column": "to_date",
          "op": "from-today"
        }
      ]
    },
    {
      "table": "settings",
      "methods": [
        "GET"
      ],
      "select": [
        "id",
        "venue_name",
        "headline",
        "intro",
        "about",
        "address",
        "area",
        "directions",
        "phone",
        "photo_hero",
        "photo_street",
        "photo_closed",
        "photo_store",
        "tax_rate",
        "slot_minutes",
        "lead_minutes",
        "preorder_days",
        "prep_minutes",
        "max_items",
        "online_on"
      ],
      "pictures": [
        "photo_hero",
        "photo_street",
        "photo_closed",
        "photo_store"
      ]
    },
    {
      "table": "orders",
      "methods": [
        "POST"
      ],
      "humanCheck": true,
      "level": "verified",
      "select": [
        "id",
        "number",
        "status",
        "channel",
        "pickup_at",
        "note",
        "item_count",
        "subtotal",
        "tax_rate",
        "tax",
        "total",
        "paid_method",
        "cancel_code",
        "cancel_dish",
        "cancel_note",
        "placed_at",
        "confirmed_at",
        "preparing_at",
        "ready_at",
        "picked_up_at",
        "cancelled_at",
        "not_collected_at",
        "link_expires"
      ],
      "writable": [
        "name",
        "email",
        "phone",
        "language",
        "pickup_at",
        "note",
        "client_key"
      ],
      "requires": [
        "name",
        "email"
      ],
      "requireSetting": [
        {
          "table": "settings",
          "column": "online_on"
        }
      ],
      "claimedBy": {
        "table": "customers",
        "column": "customer_id",
        "optional": true
      },
      "identity": {
        "table": "customers",
        "email": "email",
        "link": "customer_id",
        "fill": {
          "name": "name"
        }
      },
      "shareLink": "link_token",
      "anonymous": {
        "perValue": {
          "columns": [
            "email"
          ],
          "n": 10
        },
        "perIpHour": 10,
        "perKeyHour": 300,
        "plainText": [
          "name",
          {
            "column": "note",
            "digits": 4,
            "max": 140
          }
        ]
      },
      "maxOpen": {
        "column": "status",
        "values": [
          "placed",
          "confirmed",
          "preparing",
          "ready"
        ],
        "n": 3,
        "upcoming": "pickup_at"
      },
      "children": {
        "order_items": {
          "via": "order_id",
          "writable": [
            "menu_item_id",
            "qty",
            "note"
          ],
          "select": [
            "id",
            "position",
            "menu_item_id",
            "qty",
            "note",
            "name",
            "unit_price",
            "options_total",
            "unit_total",
            "line_total"
          ],
          "position": "position",
          "min": 1,
          "max": 20,
          "plainText": [
            {
              "column": "note",
              "digits": 4,
              "max": 80
            }
          ],
          "sumMax": {
            "column": "qty",
            "max": {
              "table": "settings",
              "column": "max_items"
            }
          },
          "children": {
            "order_item_modifiers": {
              "via": "order_item_id",
              "writable": [
                "modifier_id"
              ],
              "select": [
                "id",
                "modifier_id",
                "name",
                "price_delta"
              ],
              "max": 20,
              "agrees": [
                {
                  "column": "modifier_id",
                  "path": [
                    "group_id",
                    "item_id"
                  ],
                  "eq": {
                    "parent": "menu_item_id"
                  }
                }
              ],
              "counts": [
                {
                  "by": [
                    "modifier_id",
                    "group_id"
                  ],
                  "every": {
                    "column": "item_id",
                    "eq": {
                      "parent": "menu_item_id"
                    }
                  },
                  "min": "min",
                  "max": "max"
                }
              ]
            }
          }
        }
      },
      "dryRun": true,
      "expect": "total",
      "clientKey": "client_key"
    },
    {
      "table": "enquiries",
      "methods": [
        "POST"
      ],
      "humanCheck": true,
      "select": [
        "id",
        "ref",
        "heads",
        "wanted_on",
        "status"
      ],
      "writable": [
        "heads",
        "wanted_on",
        "notes",
        "name",
        "phone",
        "email",
        "language",
        "client_key"
      ],
      "requires": [
        "heads",
        "wanted_on",
        "name",
        "phone",
        "email"
      ],
      "anonymous": {
        "perValue": {
          "columns": [
            "email"
          ],
          "n": 5
        },
        "perIpHour": 3,
        "perKeyHour": 60,
        "plainText": [
          "name",
          {
            "column": "notes",
            "digits": 4,
            "max": 200
          }
        ]
      },
      "clientKey": "client_key"
    },
    {
      "table": "orders",
      "key": "link",
      "methods": [
        "GET",
        "PATCH"
      ],
      "select": [
        "id",
        "number",
        "status",
        "channel",
        "pickup_at",
        "name",
        "phone",
        "email",
        "note",
        "item_count",
        "subtotal",
        "tax_rate",
        "tax",
        "total",
        "paid_method",
        "cancel_code",
        "cancel_dish",
        "cancel_note",
        "placed_at",
        "confirmed_at",
        "preparing_at",
        "ready_at",
        "picked_up_at",
        "cancelled_at",
        "not_collected_at",
        "link_expires"
      ],
      "claim": {
        "by": "token",
        "column": "link_token",
        "expires": "link_expires",
        "stopped": "link_stopped",
        "own": true,
        "address": "email"
      },
      "writable": [
        "status"
      ],
      "writableValues": {
        "status": [
          "cancelled"
        ]
      },
      "writableWhen": {
        "status": [
          "placed"
        ]
      },
      "defaults": {
        "cancel_code": "self"
      }
    },
    {
      "table": "order_items",
      "key": "link",
      "methods": [
        "GET"
      ],
      "level": "verified",
      "visibleWith": {
        "table": "orders",
        "via": "order_id"
      },
      "select": [
        "id",
        "order_id",
        "position",
        "menu_item_id",
        "qty",
        "note",
        "name",
        "unit_price",
        "options_total",
        "unit_total",
        "line_total"
      ]
    },
    {
      "table": "order_item_modifiers",
      "key": "link",
      "methods": [
        "GET"
      ],
      "level": "verified",
      "visibleWith": {
        "table": "order_items",
        "via": "order_item_id"
      },
      "select": [
        "id",
        "order_item_id",
        "modifier_id",
        "name",
        "price_delta"
      ]
    }
  ],
  "roles": [
    {
      "key": "kitchen",
      "limits": {
        "orders": {
          "writable": [
            "status",
            "cancel_code",
            "cancel_dish",
            "cancel_note",
            "paid_method"
          ],
          "writableValues": {
            "status": [
              "placed",
              "confirmed",
              "preparing",
              "ready",
              "picked_up",
              "cancelled"
            ],
            "cancel_code": [
              "ran_out",
              "too_busy",
              "customer_asked",
              "other"
            ]
          },
          "creatable": [
            "name",
            "phone",
            "email",
            "note",
            "pickup_at",
            "channel"
          ],
          "creatableValues": {
            "channel": [
              "phone"
            ]
          }
        },
        "menu_items": {
          "writable": [
            "available",
            "stock_today",
            "stock_on"
          ]
        },
        "modifiers": {
          "writable": [
            "available"
          ]
        }
      }
    },
    {
      "key": "manager",
      "limits": {
        "orders": {
          "writable": [
            "number_seq",
            "number",
            "status",
            "pickup_at",
            "name",
            "phone",
            "email",
            "channel",
            "note",
            "item_count",
            "subtotal",
            "tax_rate",
            "tax",
            "total",
            "paid_method",
            "cancel_code",
            "cancel_dish",
            "cancel_note",
            "placed_at",
            "confirmed_at",
            "confirmed_by",
            "preparing_at",
            "ready_at",
            "ready_by",
            "picked_up_at",
            "picked_up_by",
            "cancelled_at",
            "cancelled_by",
            "not_collected_at",
            "language",
            "customer_id",
            "link_token",
            "link_expires",
            "link_stopped",
            "client_key"
          ],
          "writableValues": {
            "cancel_code": [
              "ran_out",
              "too_busy",
              "customer_asked",
              "other"
            ]
          }
        }
      }
    }
  ],
  "producers": [
    {
      "kind": "order-confirmation",
      "link": "order_id",
      "onCreate": {
        "table": "orders",
        "where": {
          "column": "channel",
          "eq": "online"
        }
      }
    },
    {
      "kind": "order-confirmation-phone",
      "link": "order_id",
      "onCreate": {
        "table": "orders",
        "where": {
          "column": "channel",
          "eq": "phone"
        }
      }
    },
    {
      "kind": "order-ready",
      "link": "order_id",
      "gate": {
        "setting": {
          "table": "settings",
          "column": "ready_email_on"
        }
      },
      "onChange": {
        "table": "orders",
        "column": "status",
        "to": "ready"
      },
      "holdSeconds": 20,
      "dropWhen": [
        {
          "column": "status",
          "in": [
            "placed",
            "confirmed",
            "preparing",
            "picked_up",
            "cancelled",
            "not_collected"
          ],
          "reason": "no-longer-needed"
        }
      ]
    },
    {
      "kind": "order-cancelled-ran-out",
      "link": "order_id",
      "onChange": {
        "table": "orders",
        "column": "status",
        "to": "cancelled",
        "where": {
          "column": "cancel_code",
          "eq": "ran_out"
        }
      }
    },
    {
      "kind": "order-cancelled-too-busy",
      "link": "order_id",
      "onChange": {
        "table": "orders",
        "column": "status",
        "to": "cancelled",
        "where": {
          "column": "cancel_code",
          "eq": "too_busy"
        }
      }
    },
    {
      "kind": "order-cancelled-customer-asked",
      "link": "order_id",
      "onChange": {
        "table": "orders",
        "column": "status",
        "to": "cancelled",
        "where": {
          "column": "cancel_code",
          "eq": "customer_asked"
        }
      }
    },
    {
      "kind": "order-cancelled-closed",
      "link": "order_id",
      "onChange": {
        "table": "orders",
        "column": "status",
        "to": "cancelled",
        "where": {
          "column": "cancel_code",
          "eq": "closed"
        }
      }
    },
    {
      "kind": "order-cancelled-other",
      "link": "order_id",
      "onChange": {
        "table": "orders",
        "column": "status",
        "to": "cancelled",
        "where": {
          "column": "cancel_code",
          "eq": "other"
        }
      }
    },
    {
      "kind": "order-cancelled-by-you",
      "link": "order_id",
      "onChange": {
        "table": "orders",
        "column": "status",
        "to": "cancelled",
        "where": {
          "column": "cancel_code",
          "eq": "self"
        }
      }
    },
    {
      "kind": "order-receipt",
      "link": "order_id",
      "gate": {
        "feature": "receipts",
        "setting": {
          "table": "settings",
          "column": "receipt_email_on"
        }
      },
      "repeatBy": "picked_up_at",
      "onChange": {
        "table": "orders",
        "column": "status",
        "to": "picked_up"
      },
      "holdSeconds": 20,
      "dropWhen": [
        {
          "column": "status",
          "in": [
            "ready"
          ],
          "reason": "no-longer-needed"
        }
      ]
    },
    {
      "kind": "enquiry-received",
      "link": "enquiry_id",
      "onCreate": {
        "table": "enquiries"
      },
      "recipient": {
        "column": "email",
        "name": "name",
        "language": "language"
      }
    }
  ],
  "kinds": {
    "order-confirmation": "ordering-order-confirmation",
    "order-confirmation-phone": "ordering-order-confirmation-phone",
    "order-ready": "ordering-order-ready",
    "order-cancelled-ran-out": "ordering-order-cancelled-ran-out",
    "order-cancelled-too-busy": "ordering-order-cancelled-too-busy",
    "order-cancelled-customer-asked": "ordering-order-cancelled-customer-asked",
    "order-cancelled-closed": "ordering-order-cancelled-closed",
    "order-cancelled-other": "ordering-order-cancelled-other",
    "order-cancelled-by-you": "ordering-order-cancelled-by-you",
    "order-receipt": "ordering-order-receipt",
    "enquiry-received": "ordering-enquiry-received"
  }
} as const;
