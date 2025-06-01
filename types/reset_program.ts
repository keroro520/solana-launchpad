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
      "name": "commit",
      "docs": [
        "User commits to an auction bin"
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
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  109,
                  109,
                  105,
                  116,
                  116,
                  101,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "auction"
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
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
          "name": "whitelistAuthority",
          "optional": true
        },
        {
          "name": "custodyAuthority",
          "optional": true
        },
        {
          "name": "sysvarInstructions",
          "optional": true
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
        },
        {
          "name": "expiry",
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
          "signer": true,
          "relations": [
            "committed"
          ]
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
      "name": "emergencyControl",
      "docs": [
        "Emergency control for pausing/resuming auction operations"
      ],
      "discriminator": [
        40,
        126,
        46,
        161,
        192,
        12,
        37,
        0
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "Only auction authority can control emergency state"
          ],
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
          "name": "params",
          "type": {
            "defined": {
              "name": "emergencyControlParams"
            }
          }
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
          "name": "extensions",
          "type": {
            "defined": {
              "name": "auctionExtensions"
            }
          }
        }
      ]
    },
    {
      "name": "setPrice",
      "docs": [
        "Admin sets new price for a bin"
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
        "Admin withdraws collected fees from all bins"
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
          "name": "saleTokenMint",
          "docs": [
            "Sale token mint"
          ]
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
          "name": "feeRecipientAccount",
          "docs": [
            "Fee recipient account (will be created if needed)"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "authority"
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
      "args": []
    },
    {
      "name": "withdrawFunds",
      "docs": [
        "Admin withdraws funds from all auction bins"
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
          "name": "saleTokenMint",
          "docs": [
            "Sale token mint"
          ]
        },
        {
          "name": "paymentTokenMint",
          "docs": [
            "Payment token mint"
          ]
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
          "name": "saleTokenRecipient",
          "docs": [
            "Sale token recipient account (will be created if needed)"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "authority"
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
          "name": "paymentTokenRecipient",
          "docs": [
            "Payment token recipient account (will be created if needed)"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "authority"
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
                "path": "paymentTokenMint"
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
  "events": [
    {
      "name": "committedAccountClosedEvent",
      "discriminator": [
        99,
        216,
        87,
        242,
        221,
        79,
        123,
        30
      ]
    },
    {
      "name": "emergencyControlEvent",
      "discriminator": [
        3,
        252,
        56,
        49,
        253,
        0,
        21,
        181
      ]
    }
  ],
  "errors": [
    {
      "code": 12000,
      "name": "operationPaused",
      "msg": "Operation is paused by emergency control"
    },
    {
      "code": 12001,
      "name": "onlyLaunchpadAdmin",
      "msg": "Only LaunchpadAdmin can access this function"
    },
    {
      "code": 12100,
      "name": "mathOverflow",
      "msg": "Math overflow"
    },
    {
      "code": 12101,
      "name": "mathUnderflow",
      "msg": "Math underflow"
    },
    {
      "code": 12102,
      "name": "divisionByZero",
      "msg": "Division by zero"
    },
    {
      "code": 12103,
      "name": "invalidCalculation",
      "msg": "Invalid calculation"
    },
    {
      "code": 12104,
      "name": "unauthorized",
      "msg": "unauthorized"
    },
    {
      "code": 12200,
      "name": "invalidAuctionTimeRange",
      "msg": "Invalid auction time range"
    },
    {
      "code": 12201,
      "name": "invalidAuctionBinsLength",
      "msg": "Must have 1-10 auction bins"
    },
    {
      "code": 12202,
      "name": "invalidAuctionBinsPriceOrCap",
      "msg": "Auction bin price and cap must be greater than zero"
    },
    {
      "code": 12300,
      "name": "outOfCommitmentPeriod",
      "msg": "Out of commitment period"
    },
    {
      "code": 12301,
      "name": "invalidCommitmentAmount",
      "msg": "Invalid commitment amount"
    },
    {
      "code": 12302,
      "name": "invalidBinId",
      "msg": "Invalid bin ID"
    },
    {
      "code": 12303,
      "name": "commitmentBinCapExceeded",
      "msg": "Commitment bin cap exceeded"
    },
    {
      "code": 12304,
      "name": "outOfClaimPeriod",
      "msg": "Out of claim period"
    },
    {
      "code": 12305,
      "name": "invalidClaimAmount",
      "msg": "Invalid claim amount"
    },
    {
      "code": 12306,
      "name": "commitCapExceeded",
      "msg": "Commit cap exceeded"
    },
    {
      "code": 12400,
      "name": "inCommitmentPeriod",
      "msg": "In commitment period"
    },
    {
      "code": 12401,
      "name": "doubleFundsWithdrawal",
      "msg": "Double funds withdrawal"
    },
    {
      "code": 12402,
      "name": "noClaimFeesConfigured",
      "msg": "No claim fees configured for this auction"
    },
    {
      "code": 12501,
      "name": "missingSysvarInstructions",
      "msg": "Missing sysvar instructions account"
    },
    {
      "code": 12502,
      "name": "wrongProgram",
      "msg": "Wrong program ID for Ed25519 instruction"
    },
    {
      "code": 12503,
      "name": "malformedEd25519Ix",
      "msg": "Malformed Ed25519 instruction"
    },
    {
      "code": 12504,
      "name": "wrongWhitelistAuthority",
      "msg": "Wrong whitelist authority"
    },
    {
      "code": 12505,
      "name": "payloadMismatch",
      "msg": "Payload mismatch in signature verification"
    },
    {
      "code": 12506,
      "name": "signatureExpired",
      "msg": "Signature expired"
    },
    {
      "code": 12507,
      "name": "nonceOverflow",
      "msg": "Nonce overflow"
    },
    {
      "code": 12508,
      "name": "serializationError",
      "msg": "Serialization error"
    },
    {
      "code": 12509,
      "name": "missingExpiry",
      "msg": "Missing expiry timestamp for whitelist verification"
    },
    {
      "code": 12510,
      "name": "invalidCustodyAuthority",
      "msg": "Invalid custody authority"
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
              "Launchpad admin"
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
            "name": "saleTokenMint",
            "docs": [
              "Sale token mint"
            ],
            "type": "pubkey"
          },
          {
            "name": "paymentTokenMint",
            "docs": [
              "Payment token mint"
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
              "Auction bins (up to 10 bins)"
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
            "name": "emergencyState",
            "docs": [
              "Emergency control state (newly added)"
            ],
            "type": {
              "defined": {
                "name": "emergencyState"
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
            "name": "unsoldSaleTokensAndEffectivePaymentTokensWithdrawn",
            "docs": [
              "Whether the unsold sale tokens and effective payment tokens have been",
              "withdrawn, which is used to prevent double withdrawal by `withdraw_funds`"
            ],
            "type": "bool"
          },
          {
            "name": "totalFeesCollected",
            "docs": [
              "Total fees collected from claimed sale tokens"
            ],
            "type": "u64"
          },
          {
            "name": "totalFeesWithdrawn",
            "docs": [
              "Fees withdrawn already"
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
        "Individual auction bin data"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "saleTokenPrice",
            "docs": [
              "Price per sale token (in payment tokens)"
            ],
            "type": "u64"
          },
          {
            "name": "saleTokenCap",
            "docs": [
              "Maximum sale tokens this bin can sell"
            ],
            "type": "u64"
          },
          {
            "name": "paymentTokenRaised",
            "docs": [
              "Payment tokens actually raised in this bin"
            ],
            "type": "u64"
          },
          {
            "name": "saleTokenClaimed",
            "docs": [
              "Sale tokens already claimed from this bin"
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
      "name": "committed",
      "docs": [
        "User commitment data for all auction bins",
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
            "name": "nonce",
            "docs": [
              "User's nonce for whitelist signature verification (prevents replay attacks)"
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
      "name": "committedAccountClosedEvent",
      "docs": [
        "Event emitted when a user's Committed account is fully claimed and closed"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "userKey",
            "docs": [
              "User who owned the committed account"
            ],
            "type": "pubkey"
          },
          {
            "name": "auctionKey",
            "docs": [
              "The auction this commitment was for"
            ],
            "type": "pubkey"
          },
          {
            "name": "committedAccountKey",
            "docs": [
              "The committed account that was closed"
            ],
            "type": "pubkey"
          },
          {
            "name": "rentReturned",
            "docs": [
              "Amount of rent returned to the user (in lamports)"
            ],
            "type": "u64"
          },
          {
            "name": "committedData",
            "docs": [
              "Snapshot of the committed account data at time of closure"
            ],
            "type": {
              "defined": {
                "name": "committedAccountSnapshot"
              }
            }
          }
        ]
      }
    },
    {
      "name": "committedAccountSnapshot",
      "docs": [
        "Snapshot of Committed account data for the closure event"
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
              "All bins this user committed to"
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
          },
          {
            "name": "totalPaymentCommitted",
            "docs": [
              "Total payment tokens committed across all bins"
            ],
            "type": "u64"
          },
          {
            "name": "totalSaleTokensClaimed",
            "docs": [
              "Total sale tokens claimed across all bins"
            ],
            "type": "u64"
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
          },
          {
            "name": "paymentTokenRefunded",
            "docs": [
              "Payment tokens already refunded from this bin"
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "emergencyControlEvent",
      "docs": [
        "Emergency control event"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "auction",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "pausedOperations",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "emergencyControlParams",
      "docs": [
        "Emergency control parameters for instruction"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pauseAuctionCommit",
            "type": "bool"
          },
          {
            "name": "pauseAuctionClaim",
            "type": "bool"
          },
          {
            "name": "pauseAuctionWithdrawFees",
            "type": "bool"
          },
          {
            "name": "pauseAuctionWithdrawFunds",
            "type": "bool"
          },
          {
            "name": "pauseAuctionUpdation",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "emergencyState",
      "docs": [
        "Emergency control state (embedded in Auction)"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pausedOperations",
            "docs": [
              "Paused operations bitmask"
            ],
            "type": "u64"
          }
        ]
      }
    }
  ]
};
