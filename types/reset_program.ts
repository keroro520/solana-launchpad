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
        "User claims tokens with flexible amounts (merged claim functionality)"
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
          "name": "saleTokenMint",
          "docs": [
            "Sale token mint"
          ]
        },
        {
          "name": "userSaleToken",
          "docs": [
            "User's sale token account (will be created if needed)"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "saleTokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "userPaymentToken",
          "docs": [
            "User's payment token account for refunds"
          ],
          "writable": true
        },
        {
          "name": "vaultSaleToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  115,
                  97,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "auction"
              }
            ]
          }
        },
        {
          "name": "vaultPaymentToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  112,
                  97,
                  121,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "auction"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
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
          "name": "saleTokenToClaim",
          "type": "u64"
        },
        {
          "name": "paymentTokenToRefund",
          "type": "u64"
        }
      ]
    },
    {
      "name": "claimMany",
      "docs": [
        "User claims from multiple bins in a single transaction"
      ],
      "discriminator": [
        239,
        76,
        176,
        190,
        112,
        53,
        176,
        100
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
          "name": "saleTokenMint",
          "docs": [
            "Sale token mint"
          ]
        },
        {
          "name": "userSaleToken",
          "docs": [
            "User's sale token account (will be created if needed)"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "saleTokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "userPaymentToken",
          "docs": [
            "User's payment token account for refunds"
          ],
          "writable": true
        },
        {
          "name": "vaultSaleToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  115,
                  97,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "auction"
              }
            ]
          }
        },
        {
          "name": "vaultPaymentToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  112,
                  97,
                  121,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "auction"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "claims",
          "type": {
            "vec": {
              "defined": {
                "name": "claimBinParams"
              }
            }
          }
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
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  112,
                  97,
                  121,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "auction"
              }
            ]
          }
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
      "name": "decreaseCommit",
      "docs": [
        "User decreases a commitment (renamed from revert_commit)"
      ],
      "discriminator": [
        134,
        84,
        49,
        225,
        22,
        251,
        110,
        176
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
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  112,
                  97,
                  121,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "auction"
              }
            ]
          }
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
        },
        {
          "name": "paymentTokenReverted",
          "type": "u64"
        }
      ]
    },
    {
      "name": "getLaunchpadAdmin",
      "docs": [
        "Get the hardcoded LaunchpadAdmin public key"
      ],
      "discriminator": [
        8,
        113,
        195,
        137,
        50,
        1,
        35,
        38
      ],
      "accounts": [],
      "args": [],
      "returns": "pubkey"
    },
    {
      "name": "initAuction",
      "docs": [
        "Create a new auction with automatic vault creation"
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
          "signer": true
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
          "name": "saleTokenSeller",
          "docs": [
            "Sale token seller's account (source for initial vault funding)"
          ],
          "writable": true
        },
        {
          "name": "saleTokenSellerAuthority",
          "docs": [
            "Authority of the sale token seller account"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "vaultSaleToken",
          "docs": [
            "Vault to hold sale tokens (created as PDA)"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  115,
                  97,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "auction"
              }
            ]
          }
        },
        {
          "name": "vaultPaymentToken",
          "docs": [
            "Vault to hold payment tokens (created as PDA)"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  112,
                  97,
                  121,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "auction"
              }
            ]
          }
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
        },
        {
          "name": "custody",
          "type": "pubkey"
        },
        {
          "name": "extensionParams",
          "type": {
            "option": {
              "defined": {
                "name": "auctionExtensionParams"
              }
            }
          }
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
        "Admin withdraws collected fees from all tiers (simplified - no bin_id)"
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
          "name": "vaultPaymentToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  112,
                  97,
                  121,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "auction"
              }
            ]
          }
        },
        {
          "name": "feeRecipientAccount",
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
      "name": "withdrawFunds",
      "docs": [
        "Admin withdraws funds from all auction tiers (simplified - no bin_id)"
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
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  115,
                  97,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "auction"
              }
            ]
          }
        },
        {
          "name": "vaultPaymentToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  112,
                  97,
                  121,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "auction"
              }
            ]
          }
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
      "args": []
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
      "code": 12405,
      "name": "commitCapExceeded",
      "msg": "Commit cap exceeded"
    },
    {
      "code": 12406,
      "name": "exceedsTierCap",
      "msg": "Exceeds tier cap"
    },
    {
      "code": 12407,
      "name": "invalidInput",
      "msg": "Invalid input"
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
        "PDA: [\"auction\", sale_token_mint]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "docs": [
              "Platform administrator"
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
            "name": "custody",
            "docs": [
              "Custody account for special permissions"
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
              "Auction tiers (up to 100 tiers)"
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
            "name": "extensions",
            "docs": [
              "Extension configuration (directly embedded)"
            ],
            "type": {
              "defined": {
                "name": "auctionExtensions"
              }
            }
          },
          {
            "name": "totalParticipants",
            "docs": [
              "Total number of unique participants in this auction"
            ],
            "type": "u64"
          },
          {
            "name": "vaultSaleBump",
            "docs": [
              "Vault PDA bump seeds for derivation"
            ],
            "type": "u8"
          },
          {
            "name": "vaultPaymentBump",
            "type": "u8"
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
            "name": "saleTokenCap",
            "docs": [
              "Maximum sale tokens this tier can sell"
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
            "name": "saleTokenCap",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "auctionExtensionParams",
      "docs": [
        "Extension configuration parameters for auction initialization"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "whitelistAuthority",
            "docs": [
              "Whitelist authority for access control (None = no whitelist)"
            ],
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "commitCapPerUser",
            "docs": [
              "Per-user commitment cap (None = no cap)"
            ],
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "claimFeeRate",
            "docs": [
              "Claim fee rate (None = no fee)"
            ],
            "type": {
              "option": "u64"
            }
          }
        ]
      }
    },
    {
      "name": "auctionExtensions",
      "docs": [
        "Extension configuration data (embedded in Auction)"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "whitelistAuthority",
            "docs": [
              "Whitelist authority for access control"
            ],
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "commitCapPerUser",
            "docs": [
              "Per-user commitment cap (if enabled)"
            ],
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "claimFeeRate",
            "docs": [
              "Claim fee rate (if enabled)"
            ],
            "type": {
              "option": "u64"
            }
          }
        ]
      }
    },
    {
      "name": "claimBinParams",
      "docs": [
        "Parameters for claiming from a specific bin"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "binId",
            "docs": [
              "Bin ID to claim from"
            ],
            "type": "u8"
          },
          {
            "name": "saleTokenToClaim",
            "docs": [
              "Amount of sale tokens to claim from this bin"
            ],
            "type": "u64"
          },
          {
            "name": "paymentTokenToRefund",
            "docs": [
              "Amount of payment tokens to refund from this bin"
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "committed",
      "docs": [
        "User commitment data for all auction tiers",
        "PDA: [\"committed\", auction_key, user_key]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
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
            "name": "bins",
            "docs": [
              "All bins this user has committed to"
            ],
            "type": {
              "vec": {
                "defined": {
                  "name": "committedBin"
                }
              }
            }
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
      "name": "committedBin",
      "docs": [
        "Individual bin commitment data within a user's commitment"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "binId",
            "docs": [
              "Bin ID"
            ],
            "type": "u8"
          },
          {
            "name": "paymentTokenCommitted",
            "docs": [
              "Amount of payment tokens committed to this bin"
            ],
            "type": "u64"
          },
          {
            "name": "saleTokenClaimed",
            "docs": [
              "Amount of sale tokens already claimed from this bin"
            ],
            "type": "u64"
          }
        ]
      }
    }
  ]
};
