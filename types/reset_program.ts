/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/reset_program.json`.
 */
export type ResetProgram = {
  "address": "11111111111111111111111111111111",
  "metadata": {
    "name": "resetProgram",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "claim",
      "docs": [
        "User claims all allocated tokens"
      ],
      "discriminator": [
        62,
        198,
        214,
        193,
        213,
        159,
        108,
        210
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "auction",
          "writable": true
        },
        {
          "name": "committed",
          "writable": true
        },
        {
          "name": "userSaleToken",
          "writable": true
        },
        {
          "name": "vaultSaleToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "claimAmount",
      "docs": [
        "Custody account claims specific amount (partial claiming)"
      ],
      "discriminator": [
        26,
        88,
        45,
        21,
        143,
        185,
        0,
        106
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "auction",
          "writable": true
        },
        {
          "name": "committed",
          "writable": true
        },
        {
          "name": "userSaleToken",
          "writable": true
        },
        {
          "name": "vaultSaleToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "saleTokenToClaim",
          "type": "u64"
        }
      ]
    },
    {
      "name": "commit",
      "docs": [
        "User commits to an auction tier"
      ],
      "discriminator": [
        223,
        140,
        142,
        165,
        229,
        208,
        156,
        74
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "auction",
          "writable": true
        },
        {
          "name": "committed",
          "writable": true
        },
        {
          "name": "userPaymentToken",
          "writable": true
        },
        {
          "name": "vaultPaymentToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "binId",
          "type": "u8"
        },
        {
          "name": "paymentTokenCommitted",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initAuction",
      "docs": [
        "Create a new auction"
      ],
      "discriminator": [
        73,
        108,
        200,
        53,
        221,
        115,
        20,
        41
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "launchpad"
          ]
        },
        {
          "name": "launchpad",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  115,
                  101,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "auction",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  117,
                  99,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "launchpad"
              },
              {
                "kind": "account",
                "path": "saleTokenMint"
              }
            ]
          }
        },
        {
          "name": "saleTokenMint"
        },
        {
          "name": "paymentTokenMint"
        },
        {
          "name": "vaultSaleToken",
          "docs": [
            "Vault to hold sale tokens"
          ]
        },
        {
          "name": "vaultPaymentToken",
          "docs": [
            "Vault to hold payment tokens"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "commitStartTime",
          "type": "i64"
        },
        {
          "name": "commitEndTime",
          "type": "i64"
        },
        {
          "name": "claimStartTime",
          "type": "i64"
        },
        {
          "name": "bins",
          "type": {
            "vec": {
              "defined": {
                "name": "auctionBinParams"
              }
            }
          }
        }
      ]
    },
    {
      "name": "initialize",
      "docs": [
        "Initialize the Reset Launchpad platform"
      ],
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "launchpad",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  115,
                  101,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "revertCommit",
      "docs": [
        "User reverts a commitment"
      ],
      "discriminator": [
        157,
        174,
        201,
        165,
        187,
        210,
        143,
        236
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "auction",
          "writable": true
        },
        {
          "name": "committed",
          "writable": true
        },
        {
          "name": "userPaymentToken",
          "writable": true
        },
        {
          "name": "vaultPaymentToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "paymentTokenReverted",
          "type": "u64"
        }
      ]
    },
    {
      "name": "setPrice",
      "docs": [
        "Admin sets new price for a tier"
      ],
      "discriminator": [
        16,
        19,
        182,
        8,
        149,
        83,
        72,
        181
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "auction"
          ]
        },
        {
          "name": "auction",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "binId",
          "type": "u8"
        },
        {
          "name": "newPrice",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdrawFees",
      "docs": [
        "Admin withdraws collected fees"
      ],
      "discriminator": [
        198,
        212,
        171,
        109,
        144,
        215,
        174,
        89
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "auction"
          ]
        },
        {
          "name": "auction",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "binId",
          "type": "u8"
        }
      ]
    },
    {
      "name": "withdrawFunds",
      "docs": [
        "Admin withdraws funds from auction"
      ],
      "discriminator": [
        241,
        36,
        29,
        111,
        208,
        31,
        104,
        217
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "auction"
          ]
        },
        {
          "name": "auction",
          "writable": true
        },
        {
          "name": "vaultSaleToken",
          "writable": true
        },
        {
          "name": "vaultPaymentToken",
          "writable": true
        },
        {
          "name": "authoritySaleToken",
          "writable": true
        },
        {
          "name": "authorityPaymentToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "binId",
          "type": "u8"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "auction",
      "discriminator": [
        218,
        94,
        247,
        242,
        126,
        233,
        131,
        81
      ]
    },
    {
      "name": "committed",
      "discriminator": [
        110,
        101,
        81,
        18,
        224,
        16,
        150,
        18
      ]
    },
    {
      "name": "launchpad",
      "discriminator": [
        247,
        20,
        16,
        242,
        203,
        38,
        169,
        160
      ]
    }
  ],
  "errors": [
    {
      "code": 12000,
      "name": "invalidTimeRange",
      "msg": "Invalid time range"
    },
    {
      "code": 12001,
      "name": "auctionNotStarted",
      "msg": "Auction not started"
    },
    {
      "code": 12002,
      "name": "auctionEnded",
      "msg": "Auction has ended"
    },
    {
      "code": 12003,
      "name": "claimNotStarted",
      "msg": "Claim period not started"
    },
    {
      "code": 12100,
      "name": "unauthorized",
      "msg": "Unauthorized access"
    },
    {
      "code": 12101,
      "name": "invalidAuthority",
      "msg": "Invalid authority"
    },
    {
      "code": 12200,
      "name": "mathOverflow",
      "msg": "Mathematical overflow"
    },
    {
      "code": 12201,
      "name": "mathUnderflow",
      "msg": "Mathematical underflow"
    },
    {
      "code": 12202,
      "name": "divisionByZero",
      "msg": "Division by zero"
    },
    {
      "code": 12203,
      "name": "invalidCalculation",
      "msg": "Invalid calculation"
    },
    {
      "code": 12300,
      "name": "invalidBinId",
      "msg": "Invalid bin ID"
    },
    {
      "code": 12301,
      "name": "invalidAuctionState",
      "msg": "Invalid auction state"
    },
    {
      "code": 12302,
      "name": "invalidCommitmentState",
      "msg": "Invalid commitment state"
    },
    {
      "code": 12400,
      "name": "invalidAmount",
      "msg": "Invalid amount"
    },
    {
      "code": 12401,
      "name": "invalidPrice",
      "msg": "Invalid price"
    },
    {
      "code": 12402,
      "name": "insufficientBalance",
      "msg": "Insufficient balance"
    },
    {
      "code": 12403,
      "name": "invalidTokenAccount",
      "msg": "Invalid token account"
    },
    {
      "code": 12404,
      "name": "invalidPda",
      "msg": "Invalid PDA"
    },
    {
      "code": 12500,
      "name": "systemError",
      "msg": "System error"
    },
    {
      "code": 12501,
      "name": "accountInitFailed",
      "msg": "Account initialization failed"
    }
  ],
  "types": [
    {
      "name": "auction",
      "docs": [
        "Core auction data account",
        "PDA: [\"auction\", launchpad_key, sale_token_mint]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "docs": [
              "Platform administrator (from launchpad)"
            ],
            "type": "pubkey"
          },
          {
            "name": "launchpad",
            "docs": [
              "Reference to the launchpad account"
            ],
            "type": "pubkey"
          },
          {
            "name": "saleToken",
            "docs": [
              "Sale token mint (tokens being sold)"
            ],
            "type": "pubkey"
          },
          {
            "name": "paymentToken",
            "docs": [
              "Payment token mint (tokens used for payment)"
            ],
            "type": "pubkey"
          },
          {
            "name": "vaultSaleToken",
            "docs": [
              "Vault account holding sale tokens"
            ],
            "type": "pubkey"
          },
          {
            "name": "vaultPaymentToken",
            "docs": [
              "Vault account holding payment tokens"
            ],
            "type": "pubkey"
          },
          {
            "name": "commitStartTime",
            "docs": [
              "Auction timing"
            ],
            "type": "i64"
          },
          {
            "name": "commitEndTime",
            "type": "i64"
          },
          {
            "name": "claimStartTime",
            "type": "i64"
          },
          {
            "name": "bins",
            "docs": [
              "Auction tiers (up to 5 tiers inline for efficiency)"
            ],
            "type": {
              "vec": {
                "defined": {
                  "name": "auctionBin"
                }
              }
            }
          },
          {
            "name": "hasExtensions",
            "docs": [
              "Extension management"
            ],
            "type": "bool"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump seed"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "auctionBin",
      "docs": [
        "Individual auction tier data"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "saleTokenPrice",
            "docs": [
              "Price per sale token (in payment token units)"
            ],
            "type": "u64"
          },
          {
            "name": "paymentTokenCap",
            "docs": [
              "Maximum payment tokens this tier can raise"
            ],
            "type": "u64"
          },
          {
            "name": "paymentTokenRaised",
            "docs": [
              "Payment tokens actually raised in this tier"
            ],
            "type": "u64"
          },
          {
            "name": "saleTokenClaimed",
            "docs": [
              "Sale tokens already claimed from this tier"
            ],
            "type": "u64"
          },
          {
            "name": "fundsWithdrawn",
            "docs": [
              "Whether admin has withdrawn funds from this tier"
            ],
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "auctionBinParams",
      "docs": [
        "Parameters for creating auction bins"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "saleTokenPrice",
            "type": "u64"
          },
          {
            "name": "paymentTokenCap",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "committed",
      "docs": [
        "User commitment data for a specific auction tier",
        "PDA: [\"committed\", auction_key, user_key, bin_id]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "launchpad",
            "docs": [
              "Reference to the launchpad account"
            ],
            "type": "pubkey"
          },
          {
            "name": "auction",
            "docs": [
              "Reference to the auction account"
            ],
            "type": "pubkey"
          },
          {
            "name": "user",
            "docs": [
              "User who made the commitment"
            ],
            "type": "pubkey"
          },
          {
            "name": "binId",
            "docs": [
              "Tier ID this commitment is for"
            ],
            "type": "u8"
          },
          {
            "name": "paymentTokenCommitted",
            "docs": [
              "Amount of payment tokens committed"
            ],
            "type": "u64"
          },
          {
            "name": "saleTokenClaimed",
            "docs": [
              "Amount of sale tokens already claimed"
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump seed"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "launchpad",
      "docs": [
        "Reset Launchpad global state account",
        "PDA: [\"reset\"]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "docs": [
              "Platform administrator with full control"
            ],
            "type": "pubkey"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump seed"
            ],
            "type": "u8"
          },
          {
            "name": "totalAuctions",
            "docs": [
              "Total number of auctions created"
            ],
            "type": "u64"
          },
          {
            "name": "totalFeesCollected",
            "docs": [
              "Total fees collected across all auctions"
            ],
            "type": "u64"
          },
          {
            "name": "reserved",
            "docs": [
              "Reserved space for future expansion"
            ],
            "type": {
              "array": [
                "u8",
                200
              ]
            }
          }
        ]
      }
    }
  ]
};
