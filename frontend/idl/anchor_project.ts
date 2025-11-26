/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/anchor_project.json`.
 */
export type AnchorProject = {
  "address": "DM5kNZoPPfJkow6oDv9RWaM2aNibRvRByZjyieriGKkG",
  "metadata": {
    "name": "anchorProject",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "callbackResolve",
      "discriminator": [
        62,
        48,
        157,
        206,
        37,
        5,
        117,
        131
      ],
      "accounts": [
        {
          "name": "vrfProgramIdentity",
          "docs": [
            "This check ensure that the vrf_program_identity (which is a PDA) is a signer",
            "enforcing the callback is executed by the VRF program through CPI"
          ],
          "signer": true,
          "address": "9irBy75QS2BN81FUgXuHcjqceJJRuc9oDkAe8TKVvvAw"
        },
        {
          "name": "epochResult",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  112,
                  111,
                  99,
                  104,
                  95,
                  114,
                  101,
                  115,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "epoch_result.epoch",
                "account": "epochResult"
              }
            ]
          }
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "randomness",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "claim",
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
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "epochResult",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  112,
                  111,
                  99,
                  104,
                  95,
                  114,
                  101,
                  115,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "epoch"
              }
            ]
          }
        },
        {
          "name": "commitment",
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
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "signer"
              },
              {
                "kind": "arg",
                "path": "poolId"
              },
              {
                "kind": "arg",
                "path": "epoch"
              }
            ]
          }
        },
        {
          "name": "treasuryPda",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "treasuryAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "treasuryPda"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "tokenMint"
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
          "name": "userAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "signer"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "tokenMint"
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
          "name": "tokenMint"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "poolId",
          "type": "u8"
        },
        {
          "name": "epoch",
          "type": "u64"
        }
      ]
    },
    {
      "name": "commit",
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
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "epochResult",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  112,
                  111,
                  99,
                  104,
                  95,
                  114,
                  101,
                  115,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "config.current_epoch",
                "account": "config"
              }
            ]
          }
        },
        {
          "name": "position",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "signer"
              },
              {
                "kind": "arg",
                "path": "positionId"
              }
            ]
          }
        },
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "arg",
                "path": "poolId"
              },
              {
                "kind": "account",
                "path": "config.current_epoch",
                "account": "config"
              }
            ]
          }
        },
        {
          "name": "commitment",
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
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "signer"
              },
              {
                "kind": "account",
                "path": "pool.id",
                "account": "pool"
              },
              {
                "kind": "account",
                "path": "pool.epoch",
                "account": "pool"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "positionI",
          "type": "u64"
        },
        {
          "name": "poolId",
          "type": "u8"
        }
      ]
    },
    {
      "name": "initialize",
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
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint"
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "treasuryPda",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "treasuryAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "treasuryPda"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
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
          "name": "tokenProgram"
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
          "name": "weightModel",
          "type": {
            "defined": {
              "name": "weightModel"
            }
          }
        },
        {
          "name": "resolutionType",
          "type": {
            "defined": {
              "name": "resolutionType"
            }
          }
        },
        {
          "name": "resolver",
          "type": "pubkey"
        },
        {
          "name": "epochDuration",
          "type": "i64"
        },
        {
          "name": "weightRateNumerator",
          "type": "u64"
        },
        {
          "name": "weightRateDenominator",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializePool",
      "discriminator": [
        95,
        180,
        10,
        172,
        84,
        174,
        232,
        40
      ],
      "accounts": [
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "epochResult",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  112,
                  111,
                  99,
                  104,
                  95,
                  114,
                  101,
                  115,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "config.current_epoch",
                "account": "config"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "numPools",
          "type": "u8"
        }
      ]
    },
    {
      "name": "mintPosition",
      "discriminator": [
        251,
        31,
        179,
        3,
        138,
        134,
        203,
        28
      ],
      "accounts": [
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "userAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "signer"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
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
          "name": "mint"
        },
        {
          "name": "treasuryPda",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "treasuryAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "treasuryPda"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
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
          "name": "userState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "signer"
              }
            ]
          }
        },
        {
          "name": "position",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "signer"
              },
              {
                "kind": "account",
                "path": "user_state.position_count",
                "account": "userState"
              }
            ]
          }
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "resolve",
      "discriminator": [
        246,
        150,
        236,
        206,
        108,
        63,
        58,
        10
      ],
      "accounts": [
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "epochResult",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  112,
                  111,
                  99,
                  104,
                  95,
                  114,
                  101,
                  115,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "config.current_epoch",
                "account": "config"
              }
            ]
          }
        },
        {
          "name": "oracleQueue",
          "writable": true,
          "address": "Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "programIdentity",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  100,
                  101,
                  110,
                  116,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "vrfProgram",
          "address": "Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz"
        },
        {
          "name": "slotHashes",
          "address": "SysvarS1otHashes111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "winningPoolId",
          "type": "u8"
        }
      ]
    },
    {
      "name": "updateResolutionType",
      "discriminator": [
        112,
        210,
        235,
        123,
        208,
        186,
        243,
        136
      ],
      "accounts": [
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "resolutionType",
          "type": {
            "defined": {
              "name": "resolutionType"
            }
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "commitment",
      "discriminator": [
        61,
        112,
        129,
        128,
        24,
        147,
        77,
        87
      ]
    },
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
    {
      "name": "epochResult",
      "discriminator": [
        12,
        138,
        191,
        28,
        226,
        63,
        82,
        83
      ]
    },
    {
      "name": "pool",
      "discriminator": [
        241,
        154,
        109,
        4,
        17,
        177,
        109,
        188
      ]
    },
    {
      "name": "positionAccount",
      "discriminator": [
        60,
        125,
        250,
        193,
        181,
        109,
        238,
        86
      ]
    },
    {
      "name": "userState",
      "discriminator": [
        72,
        177,
        85,
        249,
        76,
        167,
        186,
        126
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidAdd",
      "msg": "Increase position amount failed"
    },
    {
      "code": 6001,
      "name": "invalidMul",
      "msg": "Multiply operation failed"
    },
    {
      "code": 6002,
      "name": "invalidDiv",
      "msg": "Divide operation failed"
    },
    {
      "code": 6003,
      "name": "invalidCalculation",
      "msg": "Invalid calculation - possibly negative age or overflow"
    },
    {
      "code": 6004,
      "name": "unsupportedResolution",
      "msg": "Invalid resolution - invalide resolution"
    },
    {
      "code": 6005,
      "name": "epochMismatch",
      "msg": "Pool epoch does not match the expected epoch"
    },
    {
      "code": 6006,
      "name": "winningPoolNotFound",
      "msg": "Winning pool not found in provided pools"
    },
    {
      "code": 6007,
      "name": "noPoolsProvided",
      "msg": "No pools provided for resolution"
    },
    {
      "code": 6008,
      "name": "invalidPoolId",
      "msg": "Invalid pool ID - does not match commitment"
    },
    {
      "code": 6009,
      "name": "invalidEpoch",
      "msg": "Invalid epoch - does not match commitment"
    },
    {
      "code": 6010,
      "name": "alreadyClaimed",
      "msg": "Commitment has already been claimed"
    },
    {
      "code": 6011,
      "name": "losingPool",
      "msg": "Cannot claim from a losing pool"
    },
    {
      "code": 6012,
      "name": "oracleQueueRequired",
      "msg": "Oracle queue is required for Oracle resolution"
    },
    {
      "code": 6013,
      "name": "invalidOracleQueue",
      "msg": "Invalid oracle queue address"
    },
    {
      "code": 6014,
      "name": "tooManyPools",
      "msg": "Invalid pool amount - max 10"
    },
    {
      "code": 6015,
      "name": "notEnoughAccounts",
      "msg": "Invalid pool amount - doesn't match pdas"
    },
    {
      "code": 6016,
      "name": "epochEnded",
      "msg": "Epoch has ended - no new commitments allowed"
    },
    {
      "code": 6017,
      "name": "unauthorizedResolver",
      "msg": "Unauthorized: Only the resolver can call this function"
    },
    {
      "code": 6018,
      "name": "epochNotEnded",
      "msg": "Epoch has not ended yet - resolution not allowed"
    }
  ],
  "types": [
    {
      "name": "commitment",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "userPk",
            "type": "pubkey"
          },
          {
            "name": "positionAmount",
            "type": "u64"
          },
          {
            "name": "weight",
            "type": "u64"
          },
          {
            "name": "poolId",
            "type": "u8"
          },
          {
            "name": "epoch",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "config",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "resolver",
            "type": "pubkey"
          },
          {
            "name": "currentEpoch",
            "type": "u64"
          },
          {
            "name": "totalPositionsMinted",
            "type": "u64"
          },
          {
            "name": "positionPrice",
            "type": "u64"
          },
          {
            "name": "remainingTotalPosition",
            "type": "u64"
          },
          {
            "name": "allowedMint",
            "type": "pubkey"
          },
          {
            "name": "treasuryAta",
            "type": "pubkey"
          },
          {
            "name": "weightModel",
            "type": {
              "defined": {
                "name": "weightModel"
              }
            }
          },
          {
            "name": "resolutionType",
            "type": {
              "defined": {
                "name": "resolutionType"
              }
            }
          },
          {
            "name": "epochDuration",
            "type": "i64"
          },
          {
            "name": "weightRateNumerator",
            "type": "u64"
          },
          {
            "name": "weightRateDenominator",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "epochResult",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "epoch",
            "type": "u64"
          },
          {
            "name": "weight",
            "type": "u64"
          },
          {
            "name": "totalPositionAmount",
            "type": "u64"
          },
          {
            "name": "endAt",
            "type": "i64"
          },
          {
            "name": "winningPoolId",
            "type": "u8"
          },
          {
            "name": "epochResultState",
            "type": {
              "defined": {
                "name": "epochResultState"
              }
            }
          },
          {
            "name": "poolCount",
            "type": "u8"
          },
          {
            "name": "poolWeights",
            "type": {
              "array": [
                "u64",
                10
              ]
            }
          }
        ]
      }
    },
    {
      "name": "epochResultState",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "active"
          },
          {
            "name": "pending"
          },
          {
            "name": "resolved"
          }
        ]
      }
    },
    {
      "name": "pool",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "totalPositions",
            "type": "u64"
          },
          {
            "name": "totalWeight",
            "type": "u64"
          },
          {
            "name": "id",
            "type": "u8"
          },
          {
            "name": "epoch",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "positionAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "userIndex",
            "type": "u64"
          },
          {
            "name": "globalId",
            "type": "u64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "resolutionType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "admin"
          },
          {
            "name": "oracle"
          }
        ]
      }
    },
    {
      "name": "userState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "positionCount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "weightModel",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "constant"
          },
          {
            "name": "timeBased"
          }
        ]
      }
    }
  ]
};
