// 영유아성장도표 LMS 기준값
// 출처: 국민건강보험공단_영유아성장도표LMS기준_20240731 / 2017 소아청소년 성장도표

export interface GrowthLMS {
  type: "weight" | "height" | "headcircum";
  gender: "M" | "F";
  month: number;
  L: number;
  M: number;
  S: number;
}

export type GrowthMetric = GrowthLMS["type"];
export type GrowthGender = GrowthLMS["gender"];

export const growthLMS: GrowthLMS[] = [
  {
    "type": "headcircum",
    "gender": "F",
    "month": 0,
    "L": 1,
    "M": 33.8787,
    "S": 0.035
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 1,
    "L": 1,
    "M": 36.5463,
    "S": 0.0321
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 2,
    "L": 1,
    "M": 38.2521,
    "S": 0.0317
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 3,
    "L": 1,
    "M": 39.5328,
    "S": 0.0314
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 4,
    "L": 1,
    "M": 40.5817,
    "S": 0.0312
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 5,
    "L": 1,
    "M": 41.459,
    "S": 0.031
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 6,
    "L": 1,
    "M": 42.1995,
    "S": 0.0309
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 7,
    "L": 1,
    "M": 42.829,
    "S": 0.0308
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 8,
    "L": 1,
    "M": 43.3671,
    "S": 0.0306
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 9,
    "L": 1,
    "M": 43.83,
    "S": 0.0305
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 10,
    "L": 1,
    "M": 44.2319,
    "S": 0.0304
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 11,
    "L": 1,
    "M": 44.5844,
    "S": 0.0304
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 12,
    "L": 1,
    "M": 44.8965,
    "S": 0.0303
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 13,
    "L": 1,
    "M": 45.1752,
    "S": 0.0302
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 14,
    "L": 1,
    "M": 45.4265,
    "S": 0.0301
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 15,
    "L": 1,
    "M": 45.6551,
    "S": 0.0301
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 16,
    "L": 1,
    "M": 45.865,
    "S": 0.03
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 17,
    "L": 1,
    "M": 46.0598,
    "S": 0.0299
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 18,
    "L": 1,
    "M": 46.2424,
    "S": 0.0299
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 19,
    "L": 1,
    "M": 46.4152,
    "S": 0.0298
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 20,
    "L": 1,
    "M": 46.5801,
    "S": 0.0298
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 21,
    "L": 1,
    "M": 46.7384,
    "S": 0.0297
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 22,
    "L": 1,
    "M": 46.8913,
    "S": 0.0297
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 23,
    "L": 1,
    "M": 47.0391,
    "S": 0.0296
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 24,
    "L": 1,
    "M": 47.1822,
    "S": 0.0296
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 25,
    "L": 1,
    "M": 47.3204,
    "S": 0.0295
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 26,
    "L": 1,
    "M": 47.4536,
    "S": 0.0295
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 27,
    "L": 1,
    "M": 47.5817,
    "S": 0.0295
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 28,
    "L": 1,
    "M": 47.7045,
    "S": 0.0294
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 29,
    "L": 1,
    "M": 47.8219,
    "S": 0.0294
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 30,
    "L": 1,
    "M": 47.934,
    "S": 0.0293
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 31,
    "L": 1,
    "M": 48.041,
    "S": 0.0293
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 32,
    "L": 1,
    "M": 48.1432,
    "S": 0.0293
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 33,
    "L": 1,
    "M": 48.2408,
    "S": 0.0292
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 34,
    "L": 1,
    "M": 48.3343,
    "S": 0.0292
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 35,
    "L": 1,
    "M": 48.4239,
    "S": 0.0292
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 36,
    "L": 0.9102,
    "M": 48.8484,
    "S": 0.0316
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 37,
    "L": 0.8051,
    "M": 48.9187,
    "S": 0.0314
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 38,
    "L": 0.6983,
    "M": 48.989,
    "S": 0.0312
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 39,
    "L": 0.5898,
    "M": 49.0593,
    "S": 0.031
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 40,
    "L": 0.4796,
    "M": 49.1297,
    "S": 0.0308
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 41,
    "L": 0.3676,
    "M": 49.2002,
    "S": 0.0306
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 42,
    "L": 0.3414,
    "M": 49.2609,
    "S": 0.0305
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 43,
    "L": 0.3151,
    "M": 49.3216,
    "S": 0.0303
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 44,
    "L": 0.2884,
    "M": 49.3824,
    "S": 0.0302
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 45,
    "L": 0.2617,
    "M": 49.4432,
    "S": 0.03
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 46,
    "L": 0.2532,
    "M": 49.4984,
    "S": 0.0299
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 47,
    "L": 0.2446,
    "M": 49.5536,
    "S": 0.0297
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 48,
    "L": 0.2361,
    "M": 49.6089,
    "S": 0.0296
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 49,
    "L": 0.2275,
    "M": 49.6641,
    "S": 0.0294
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 50,
    "L": 0.2189,
    "M": 49.7194,
    "S": 0.0293
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 51,
    "L": 0.2743,
    "M": 49.7733,
    "S": 0.0291
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 52,
    "L": 0.3298,
    "M": 49.8273,
    "S": 0.0289
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 53,
    "L": 0.3855,
    "M": 49.8812,
    "S": 0.0288
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 54,
    "L": 0.4413,
    "M": 49.935,
    "S": 0.0286
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 55,
    "L": 0.3505,
    "M": 49.9864,
    "S": 0.0285
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 56,
    "L": 0.2603,
    "M": 50.0379,
    "S": 0.0283
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 57,
    "L": 0.1707,
    "M": 50.0895,
    "S": 0.0282
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 58,
    "L": 0.0817,
    "M": 50.1412,
    "S": 0.028
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 59,
    "L": -0.0066,
    "M": 50.193,
    "S": 0.0279
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 60,
    "L": -0.1328,
    "M": 50.2441,
    "S": 0.0278
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 61,
    "L": -0.2573,
    "M": 50.2954,
    "S": 0.0278
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 62,
    "L": -0.3801,
    "M": 50.3468,
    "S": 0.0277
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 63,
    "L": -0.5013,
    "M": 50.3982,
    "S": 0.0277
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 64,
    "L": -0.622,
    "M": 50.4493,
    "S": 0.0276
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 65,
    "L": -0.7409,
    "M": 50.5005,
    "S": 0.0276
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 66,
    "L": -0.8581,
    "M": 50.5518,
    "S": 0.0276
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 67,
    "L": -0.9736,
    "M": 50.6031,
    "S": 0.0275
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 68,
    "L": -1.0875,
    "M": 50.6546,
    "S": 0.0275
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 69,
    "L": -1.209,
    "M": 50.706,
    "S": 0.0274
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 70,
    "L": -1.3285,
    "M": 50.7575,
    "S": 0.0274
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 71,
    "L": -1.4463,
    "M": 50.8091,
    "S": 0.0274
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 72,
    "L": -1.5622,
    "M": 50.8608,
    "S": 0.0273
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 73,
    "L": -1.4198,
    "M": 50.4134,
    "S": 0.0281
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 74,
    "L": -1.4369,
    "M": 50.4284,
    "S": 0.0281
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 75,
    "L": -1.454,
    "M": 50.4427,
    "S": 0.028
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 76,
    "L": -1.4711,
    "M": 50.4563,
    "S": 0.028
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 77,
    "L": -1.4881,
    "M": 50.4693,
    "S": 0.028
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 78,
    "L": -1.5051,
    "M": 50.4815,
    "S": 0.0279
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 79,
    "L": -1.522,
    "M": 50.4932,
    "S": 0.0279
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 80,
    "L": -1.539,
    "M": 50.5042,
    "S": 0.0279
  },
  {
    "type": "headcircum",
    "gender": "F",
    "month": 81,
    "L": -1.5474,
    "M": 50.5095,
    "S": 0.0278
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 0,
    "L": 1,
    "M": 34.4618,
    "S": 0.0369
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 1,
    "L": 1,
    "M": 37.2759,
    "S": 0.0313
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 2,
    "L": 1,
    "M": 39.1285,
    "S": 0.03
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 3,
    "L": 1,
    "M": 40.5135,
    "S": 0.0292
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 4,
    "L": 1,
    "M": 41.6317,
    "S": 0.0287
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 5,
    "L": 1,
    "M": 42.5576,
    "S": 0.0284
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 6,
    "L": 1,
    "M": 43.3306,
    "S": 0.0282
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 7,
    "L": 1,
    "M": 43.9803,
    "S": 0.028
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 8,
    "L": 1,
    "M": 44.53,
    "S": 0.028
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 9,
    "L": 1,
    "M": 44.9998,
    "S": 0.0279
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 10,
    "L": 1,
    "M": 45.4051,
    "S": 0.0279
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 11,
    "L": 1,
    "M": 45.7573,
    "S": 0.0279
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 12,
    "L": 1,
    "M": 46.0661,
    "S": 0.0279
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 13,
    "L": 1,
    "M": 46.3395,
    "S": 0.0279
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 14,
    "L": 1,
    "M": 46.5844,
    "S": 0.0279
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 15,
    "L": 1,
    "M": 46.806,
    "S": 0.0279
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 16,
    "L": 1,
    "M": 47.0088,
    "S": 0.028
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 17,
    "L": 1,
    "M": 47.1962,
    "S": 0.028
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 18,
    "L": 1,
    "M": 47.3711,
    "S": 0.028
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 19,
    "L": 1,
    "M": 47.5357,
    "S": 0.028
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 20,
    "L": 1,
    "M": 47.6919,
    "S": 0.0281
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 21,
    "L": 1,
    "M": 47.8408,
    "S": 0.0281
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 22,
    "L": 1,
    "M": 47.9833,
    "S": 0.0281
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 23,
    "L": 1,
    "M": 48.1201,
    "S": 0.0282
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 24,
    "L": 1,
    "M": 48.2515,
    "S": 0.0282
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 25,
    "L": 1,
    "M": 48.3777,
    "S": 0.0283
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 26,
    "L": 1,
    "M": 48.4989,
    "S": 0.0283
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 27,
    "L": 1,
    "M": 48.6151,
    "S": 0.0283
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 28,
    "L": 1,
    "M": 48.7264,
    "S": 0.0284
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 29,
    "L": 1,
    "M": 48.8331,
    "S": 0.0284
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 30,
    "L": 1,
    "M": 48.9351,
    "S": 0.0285
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 31,
    "L": 1,
    "M": 49.0327,
    "S": 0.0285
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 32,
    "L": 1,
    "M": 49.126,
    "S": 0.0286
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 33,
    "L": 1,
    "M": 49.2153,
    "S": 0.0286
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 34,
    "L": 1,
    "M": 49.3007,
    "S": 0.0286
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 35,
    "L": 1,
    "M": 49.3826,
    "S": 0.0287
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 36,
    "L": 2.6606,
    "M": 49.8263,
    "S": 0.0321
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 37,
    "L": 2.5227,
    "M": 49.89,
    "S": 0.0317
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 38,
    "L": 2.3873,
    "M": 49.9542,
    "S": 0.0314
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 39,
    "L": 2.2545,
    "M": 50.019,
    "S": 0.031
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 40,
    "L": 2.1241,
    "M": 50.0842,
    "S": 0.0306
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 41,
    "L": 1.9959,
    "M": 50.1499,
    "S": 0.0303
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 42,
    "L": 1.8796,
    "M": 50.2081,
    "S": 0.03
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 43,
    "L": 1.7645,
    "M": 50.2665,
    "S": 0.0297
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 44,
    "L": 1.6508,
    "M": 50.3253,
    "S": 0.0294
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 45,
    "L": 1.5382,
    "M": 50.3843,
    "S": 0.0292
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 46,
    "L": 1.3446,
    "M": 50.4352,
    "S": 0.029
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 47,
    "L": 1.1511,
    "M": 50.4863,
    "S": 0.0288
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 48,
    "L": 0.9577,
    "M": 50.5376,
    "S": 0.0287
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 49,
    "L": 0.7644,
    "M": 50.5892,
    "S": 0.0285
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 50,
    "L": 0.5712,
    "M": 50.6409,
    "S": 0.0283
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 51,
    "L": 0.3363,
    "M": 50.687,
    "S": 0.0282
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 52,
    "L": 0.1,
    "M": 50.7331,
    "S": 0.0282
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 53,
    "L": -0.1374,
    "M": 50.7793,
    "S": 0.0281
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 54,
    "L": -0.376,
    "M": 50.8255,
    "S": 0.028
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 55,
    "L": -0.4655,
    "M": 50.8738,
    "S": 0.0279
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 56,
    "L": -0.5556,
    "M": 50.922,
    "S": 0.0279
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 57,
    "L": -0.646,
    "M": 50.9703,
    "S": 0.0279
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 58,
    "L": -0.7368,
    "M": 51.0185,
    "S": 0.0278
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 59,
    "L": -0.828,
    "M": 51.0667,
    "S": 0.0278
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 60,
    "L": -0.7259,
    "M": 51.114,
    "S": 0.0278
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 61,
    "L": -0.6237,
    "M": 51.1612,
    "S": 0.0278
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 62,
    "L": -0.5214,
    "M": 51.2084,
    "S": 0.0278
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 63,
    "L": -0.4189,
    "M": 51.2557,
    "S": 0.0278
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 64,
    "L": -0.295,
    "M": 51.3024,
    "S": 0.0278
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 65,
    "L": -0.1709,
    "M": 51.3491,
    "S": 0.0278
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 66,
    "L": -0.0465,
    "M": 51.3959,
    "S": 0.0278
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 67,
    "L": 0.0779,
    "M": 51.4426,
    "S": 0.0278
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 68,
    "L": 0.2026,
    "M": 51.4894,
    "S": 0.0278
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 69,
    "L": 0.3581,
    "M": 51.5362,
    "S": 0.0278
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 70,
    "L": 0.5139,
    "M": 51.583,
    "S": 0.0278
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 71,
    "L": 0.6699,
    "M": 51.6297,
    "S": 0.0278
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 72,
    "L": 0.8262,
    "M": 51.6765,
    "S": 0.0278
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 73,
    "L": -2.1298,
    "M": 51.1531,
    "S": 0.0286
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 74,
    "L": -2.2171,
    "M": 51.1629,
    "S": 0.0285
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 75,
    "L": -2.3042,
    "M": 51.172,
    "S": 0.0285
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 76,
    "L": -2.3912,
    "M": 51.1804,
    "S": 0.0285
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 77,
    "L": -2.478,
    "M": 51.1881,
    "S": 0.0285
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 78,
    "L": -2.5647,
    "M": 51.1951,
    "S": 0.0284
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 79,
    "L": -2.6512,
    "M": 51.2015,
    "S": 0.0284
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 80,
    "L": -2.7376,
    "M": 51.2073,
    "S": 0.0284
  },
  {
    "type": "headcircum",
    "gender": "M",
    "month": 81,
    "L": -2.7807,
    "M": 51.21,
    "S": 0.0283
  },
  {
    "type": "height",
    "gender": "F",
    "month": 0,
    "L": 1,
    "M": 49.1477,
    "S": 0.0379
  },
  {
    "type": "height",
    "gender": "F",
    "month": 1,
    "L": 1,
    "M": 53.6872,
    "S": 0.0364
  },
  {
    "type": "height",
    "gender": "F",
    "month": 2,
    "L": 1,
    "M": 57.0673,
    "S": 0.0357
  },
  {
    "type": "height",
    "gender": "F",
    "month": 3,
    "L": 1,
    "M": 59.8029,
    "S": 0.0352
  },
  {
    "type": "height",
    "gender": "F",
    "month": 4,
    "L": 1,
    "M": 62.0899,
    "S": 0.0349
  },
  {
    "type": "height",
    "gender": "F",
    "month": 5,
    "L": 1,
    "M": 64.0301,
    "S": 0.0346
  },
  {
    "type": "height",
    "gender": "F",
    "month": 6,
    "L": 1,
    "M": 65.7311,
    "S": 0.0345
  },
  {
    "type": "height",
    "gender": "F",
    "month": 7,
    "L": 1,
    "M": 67.2873,
    "S": 0.0344
  },
  {
    "type": "height",
    "gender": "F",
    "month": 8,
    "L": 1,
    "M": 68.7498,
    "S": 0.0344
  },
  {
    "type": "height",
    "gender": "F",
    "month": 9,
    "L": 1,
    "M": 70.1435,
    "S": 0.0344
  },
  {
    "type": "height",
    "gender": "F",
    "month": 10,
    "L": 1,
    "M": 71.4818,
    "S": 0.0345
  },
  {
    "type": "height",
    "gender": "F",
    "month": 11,
    "L": 1,
    "M": 72.771,
    "S": 0.0346
  },
  {
    "type": "height",
    "gender": "F",
    "month": 12,
    "L": 1,
    "M": 74.015,
    "S": 0.0348
  },
  {
    "type": "height",
    "gender": "F",
    "month": 13,
    "L": 1,
    "M": 75.2176,
    "S": 0.035
  },
  {
    "type": "height",
    "gender": "F",
    "month": 14,
    "L": 1,
    "M": 76.3817,
    "S": 0.0351
  },
  {
    "type": "height",
    "gender": "F",
    "month": 15,
    "L": 1,
    "M": 77.5099,
    "S": 0.0353
  },
  {
    "type": "height",
    "gender": "F",
    "month": 16,
    "L": 1,
    "M": 78.6055,
    "S": 0.0356
  },
  {
    "type": "height",
    "gender": "F",
    "month": 17,
    "L": 1,
    "M": 79.671,
    "S": 0.0358
  },
  {
    "type": "height",
    "gender": "F",
    "month": 18,
    "L": 1,
    "M": 80.7079,
    "S": 0.036
  },
  {
    "type": "height",
    "gender": "F",
    "month": 19,
    "L": 1,
    "M": 81.7182,
    "S": 0.0362
  },
  {
    "type": "height",
    "gender": "F",
    "month": 20,
    "L": 1,
    "M": 82.7036,
    "S": 0.0364
  },
  {
    "type": "height",
    "gender": "F",
    "month": 21,
    "L": 1,
    "M": 83.6654,
    "S": 0.0367
  },
  {
    "type": "height",
    "gender": "F",
    "month": 22,
    "L": 1,
    "M": 84.604,
    "S": 0.0369
  },
  {
    "type": "height",
    "gender": "F",
    "month": 23,
    "L": 1,
    "M": 85.5202,
    "S": 0.0371
  },
  {
    "type": "height",
    "gender": "F",
    "month": 24,
    "L": 1,
    "M": 85.7153,
    "S": 0.0376
  },
  {
    "type": "height",
    "gender": "F",
    "month": 25,
    "L": 1,
    "M": 86.5904,
    "S": 0.0379
  },
  {
    "type": "height",
    "gender": "F",
    "month": 26,
    "L": 1,
    "M": 87.4462,
    "S": 0.0381
  },
  {
    "type": "height",
    "gender": "F",
    "month": 27,
    "L": 1,
    "M": 88.283,
    "S": 0.0383
  },
  {
    "type": "height",
    "gender": "F",
    "month": 28,
    "L": 1,
    "M": 89.1004,
    "S": 0.0385
  },
  {
    "type": "height",
    "gender": "F",
    "month": 29,
    "L": 1,
    "M": 89.8991,
    "S": 0.0387
  },
  {
    "type": "height",
    "gender": "F",
    "month": 30,
    "L": 1,
    "M": 90.6797,
    "S": 0.0389
  },
  {
    "type": "height",
    "gender": "F",
    "month": 31,
    "L": 1,
    "M": 91.443,
    "S": 0.0391
  },
  {
    "type": "height",
    "gender": "F",
    "month": 32,
    "L": 1,
    "M": 92.1906,
    "S": 0.0393
  },
  {
    "type": "height",
    "gender": "F",
    "month": 33,
    "L": 1,
    "M": 92.9239,
    "S": 0.0395
  },
  {
    "type": "height",
    "gender": "F",
    "month": 34,
    "L": 1,
    "M": 93.6444,
    "S": 0.0397
  },
  {
    "type": "height",
    "gender": "F",
    "month": 35,
    "L": 1,
    "M": 94.3533,
    "S": 0.0399
  },
  {
    "type": "height",
    "gender": "F",
    "month": 36,
    "L": 0.5472,
    "M": 95.4078,
    "S": 0.0413
  },
  {
    "type": "height",
    "gender": "F",
    "month": 37,
    "L": 0.4997,
    "M": 95.9472,
    "S": 0.0412
  },
  {
    "type": "height",
    "gender": "F",
    "month": 38,
    "L": 0.4525,
    "M": 96.4867,
    "S": 0.0411
  },
  {
    "type": "height",
    "gender": "F",
    "month": 39,
    "L": 0.4056,
    "M": 97.0262,
    "S": 0.041
  },
  {
    "type": "height",
    "gender": "F",
    "month": 40,
    "L": 0.359,
    "M": 97.5658,
    "S": 0.0409
  },
  {
    "type": "height",
    "gender": "F",
    "month": 41,
    "L": 0.3126,
    "M": 98.1054,
    "S": 0.0408
  },
  {
    "type": "height",
    "gender": "F",
    "month": 42,
    "L": 0.2825,
    "M": 98.6465,
    "S": 0.0407
  },
  {
    "type": "height",
    "gender": "F",
    "month": 43,
    "L": 0.2526,
    "M": 99.1877,
    "S": 0.0406
  },
  {
    "type": "height",
    "gender": "F",
    "month": 44,
    "L": 0.2229,
    "M": 99.7288,
    "S": 0.0405
  },
  {
    "type": "height",
    "gender": "F",
    "month": 45,
    "L": 0.1934,
    "M": 100.27,
    "S": 0.0404
  },
  {
    "type": "height",
    "gender": "F",
    "month": 46,
    "L": 0.164,
    "M": 100.8113,
    "S": 0.0403
  },
  {
    "type": "height",
    "gender": "F",
    "month": 47,
    "L": 0.1348,
    "M": 101.3525,
    "S": 0.0402
  },
  {
    "type": "height",
    "gender": "F",
    "month": 48,
    "L": 0.1129,
    "M": 101.8943,
    "S": 0.0401
  },
  {
    "type": "height",
    "gender": "F",
    "month": 49,
    "L": 0.0912,
    "M": 102.4361,
    "S": 0.04
  },
  {
    "type": "height",
    "gender": "F",
    "month": 50,
    "L": 0.0695,
    "M": 102.9779,
    "S": 0.0399
  },
  {
    "type": "height",
    "gender": "F",
    "month": 51,
    "L": 0.048,
    "M": 103.5197,
    "S": 0.0398
  },
  {
    "type": "height",
    "gender": "F",
    "month": 52,
    "L": 0.0267,
    "M": 104.0616,
    "S": 0.0397
  },
  {
    "type": "height",
    "gender": "F",
    "month": 53,
    "L": 0.0054,
    "M": 104.6034,
    "S": 0.0396
  },
  {
    "type": "height",
    "gender": "F",
    "month": 54,
    "L": -0.0216,
    "M": 105.1425,
    "S": 0.0395
  },
  {
    "type": "height",
    "gender": "F",
    "month": 55,
    "L": -0.0484,
    "M": 105.6816,
    "S": 0.0395
  },
  {
    "type": "height",
    "gender": "F",
    "month": 56,
    "L": -0.0751,
    "M": 106.2208,
    "S": 0.0394
  },
  {
    "type": "height",
    "gender": "F",
    "month": 57,
    "L": -0.1016,
    "M": 106.76,
    "S": 0.0393
  },
  {
    "type": "height",
    "gender": "F",
    "month": 58,
    "L": -0.128,
    "M": 107.2992,
    "S": 0.0392
  },
  {
    "type": "height",
    "gender": "F",
    "month": 59,
    "L": -0.1543,
    "M": 107.8384,
    "S": 0.0391
  },
  {
    "type": "height",
    "gender": "F",
    "month": 60,
    "L": -0.1404,
    "M": 108.3714,
    "S": 0.039
  },
  {
    "type": "height",
    "gender": "F",
    "month": 61,
    "L": -0.1266,
    "M": 108.9045,
    "S": 0.039
  },
  {
    "type": "height",
    "gender": "F",
    "month": 62,
    "L": -0.113,
    "M": 109.4375,
    "S": 0.0389
  },
  {
    "type": "height",
    "gender": "F",
    "month": 63,
    "L": -0.0994,
    "M": 109.9706,
    "S": 0.0389
  },
  {
    "type": "height",
    "gender": "F",
    "month": 64,
    "L": -0.086,
    "M": 110.5036,
    "S": 0.0388
  },
  {
    "type": "height",
    "gender": "F",
    "month": 65,
    "L": -0.0726,
    "M": 111.0366,
    "S": 0.0388
  },
  {
    "type": "height",
    "gender": "F",
    "month": 66,
    "L": -0.0272,
    "M": 111.5656,
    "S": 0.0388
  },
  {
    "type": "height",
    "gender": "F",
    "month": 67,
    "L": 0.0175,
    "M": 112.0946,
    "S": 0.0388
  },
  {
    "type": "height",
    "gender": "F",
    "month": 68,
    "L": 0.0614,
    "M": 112.6235,
    "S": 0.0388
  },
  {
    "type": "height",
    "gender": "F",
    "month": 69,
    "L": 0.1047,
    "M": 113.1523,
    "S": 0.0388
  },
  {
    "type": "height",
    "gender": "F",
    "month": 70,
    "L": 0.1472,
    "M": 113.6811,
    "S": 0.0388
  },
  {
    "type": "height",
    "gender": "F",
    "month": 71,
    "L": 0.1891,
    "M": 114.2098,
    "S": 0.0388
  },
  {
    "type": "height",
    "gender": "F",
    "month": 72,
    "L": 0.2115,
    "M": 114.7289,
    "S": 0.0388
  },
  {
    "type": "height",
    "gender": "F",
    "month": 73,
    "L": 0.2335,
    "M": 115.2479,
    "S": 0.0388
  },
  {
    "type": "height",
    "gender": "F",
    "month": 74,
    "L": 0.255,
    "M": 115.767,
    "S": 0.0389
  },
  {
    "type": "height",
    "gender": "F",
    "month": 75,
    "L": 0.2762,
    "M": 116.286,
    "S": 0.0389
  },
  {
    "type": "height",
    "gender": "F",
    "month": 76,
    "L": 0.297,
    "M": 116.805,
    "S": 0.039
  },
  {
    "type": "height",
    "gender": "F",
    "month": 77,
    "L": 0.3174,
    "M": 117.324,
    "S": 0.039
  },
  {
    "type": "height",
    "gender": "F",
    "month": 78,
    "L": 0.2769,
    "M": 117.8257,
    "S": 0.0391
  },
  {
    "type": "height",
    "gender": "F",
    "month": 79,
    "L": 0.2373,
    "M": 118.3274,
    "S": 0.0391
  },
  {
    "type": "height",
    "gender": "F",
    "month": 80,
    "L": 0.1986,
    "M": 118.8292,
    "S": 0.0392
  },
  {
    "type": "height",
    "gender": "F",
    "month": 81,
    "L": 0.1606,
    "M": 119.331,
    "S": 0.0393
  },
  {
    "type": "height",
    "gender": "F",
    "month": 82,
    "L": 0.1235,
    "M": 119.8329,
    "S": 0.0394
  },
  {
    "type": "height",
    "gender": "F",
    "month": 83,
    "L": 0.0872,
    "M": 120.3348,
    "S": 0.0394
  },
  {
    "type": "height",
    "gender": "M",
    "month": 0,
    "L": 1,
    "M": 49.8842,
    "S": 0.038
  },
  {
    "type": "height",
    "gender": "M",
    "month": 1,
    "L": 1,
    "M": 54.7244,
    "S": 0.0356
  },
  {
    "type": "height",
    "gender": "M",
    "month": 2,
    "L": 1,
    "M": 58.4249,
    "S": 0.0342
  },
  {
    "type": "height",
    "gender": "M",
    "month": 3,
    "L": 1,
    "M": 61.4292,
    "S": 0.0333
  },
  {
    "type": "height",
    "gender": "M",
    "month": 4,
    "L": 1,
    "M": 63.886,
    "S": 0.0326
  },
  {
    "type": "height",
    "gender": "M",
    "month": 5,
    "L": 1,
    "M": 65.9026,
    "S": 0.032
  },
  {
    "type": "height",
    "gender": "M",
    "month": 6,
    "L": 1,
    "M": 67.6236,
    "S": 0.0317
  },
  {
    "type": "height",
    "gender": "M",
    "month": 7,
    "L": 1,
    "M": 69.1645,
    "S": 0.0314
  },
  {
    "type": "height",
    "gender": "M",
    "month": 8,
    "L": 1,
    "M": 70.5994,
    "S": 0.0312
  },
  {
    "type": "height",
    "gender": "M",
    "month": 9,
    "L": 1,
    "M": 71.9687,
    "S": 0.0312
  },
  {
    "type": "height",
    "gender": "M",
    "month": 10,
    "L": 1,
    "M": 73.2812,
    "S": 0.0312
  },
  {
    "type": "height",
    "gender": "M",
    "month": 11,
    "L": 1,
    "M": 74.5388,
    "S": 0.0313
  },
  {
    "type": "height",
    "gender": "M",
    "month": 12,
    "L": 1,
    "M": 75.7488,
    "S": 0.0314
  },
  {
    "type": "height",
    "gender": "M",
    "month": 13,
    "L": 1,
    "M": 76.9186,
    "S": 0.0315
  },
  {
    "type": "height",
    "gender": "M",
    "month": 14,
    "L": 1,
    "M": 78.0497,
    "S": 0.0317
  },
  {
    "type": "height",
    "gender": "M",
    "month": 15,
    "L": 1,
    "M": 79.1458,
    "S": 0.032
  },
  {
    "type": "height",
    "gender": "M",
    "month": 16,
    "L": 1,
    "M": 80.2113,
    "S": 0.0322
  },
  {
    "type": "height",
    "gender": "M",
    "month": 17,
    "L": 1,
    "M": 81.2487,
    "S": 0.0325
  },
  {
    "type": "height",
    "gender": "M",
    "month": 18,
    "L": 1,
    "M": 82.2587,
    "S": 0.0328
  },
  {
    "type": "height",
    "gender": "M",
    "month": 19,
    "L": 1,
    "M": 83.2418,
    "S": 0.0331
  },
  {
    "type": "height",
    "gender": "M",
    "month": 20,
    "L": 1,
    "M": 84.1996,
    "S": 0.0334
  },
  {
    "type": "height",
    "gender": "M",
    "month": 21,
    "L": 1,
    "M": 85.1348,
    "S": 0.0338
  },
  {
    "type": "height",
    "gender": "M",
    "month": 22,
    "L": 1,
    "M": 86.0477,
    "S": 0.0341
  },
  {
    "type": "height",
    "gender": "M",
    "month": 23,
    "L": 1,
    "M": 86.941,
    "S": 0.0345
  },
  {
    "type": "height",
    "gender": "M",
    "month": 24,
    "L": 1,
    "M": 87.1161,
    "S": 0.0351
  },
  {
    "type": "height",
    "gender": "M",
    "month": 25,
    "L": 1,
    "M": 87.972,
    "S": 0.0354
  },
  {
    "type": "height",
    "gender": "M",
    "month": 26,
    "L": 1,
    "M": 88.8065,
    "S": 0.0358
  },
  {
    "type": "height",
    "gender": "M",
    "month": 27,
    "L": 1,
    "M": 89.6197,
    "S": 0.0361
  },
  {
    "type": "height",
    "gender": "M",
    "month": 28,
    "L": 1,
    "M": 90.412,
    "S": 0.0364
  },
  {
    "type": "height",
    "gender": "M",
    "month": 29,
    "L": 1,
    "M": 91.1828,
    "S": 0.0367
  },
  {
    "type": "height",
    "gender": "M",
    "month": 30,
    "L": 1,
    "M": 91.9327,
    "S": 0.037
  },
  {
    "type": "height",
    "gender": "M",
    "month": 31,
    "L": 1,
    "M": 92.6631,
    "S": 0.0373
  },
  {
    "type": "height",
    "gender": "M",
    "month": 32,
    "L": 1,
    "M": 93.3753,
    "S": 0.0376
  },
  {
    "type": "height",
    "gender": "M",
    "month": 33,
    "L": 1,
    "M": 94.0711,
    "S": 0.0379
  },
  {
    "type": "height",
    "gender": "M",
    "month": 34,
    "L": 1,
    "M": 94.7532,
    "S": 0.0381
  },
  {
    "type": "height",
    "gender": "M",
    "month": 35,
    "L": 1,
    "M": 95.4236,
    "S": 0.0384
  },
  {
    "type": "height",
    "gender": "M",
    "month": 36,
    "L": -1.0915,
    "M": 96.4961,
    "S": 0.0403
  },
  {
    "type": "height",
    "gender": "M",
    "month": 37,
    "L": -1.0011,
    "M": 97.0464,
    "S": 0.0403
  },
  {
    "type": "height",
    "gender": "M",
    "month": 38,
    "L": -0.9126,
    "M": 97.5965,
    "S": 0.0402
  },
  {
    "type": "height",
    "gender": "M",
    "month": 39,
    "L": -0.8262,
    "M": 98.1463,
    "S": 0.0402
  },
  {
    "type": "height",
    "gender": "M",
    "month": 40,
    "L": -0.7418,
    "M": 98.6959,
    "S": 0.0402
  },
  {
    "type": "height",
    "gender": "M",
    "month": 41,
    "L": -0.6592,
    "M": 99.2452,
    "S": 0.0402
  },
  {
    "type": "height",
    "gender": "M",
    "month": 42,
    "L": -0.5827,
    "M": 99.793,
    "S": 0.0401
  },
  {
    "type": "height",
    "gender": "M",
    "month": 43,
    "L": -0.5077,
    "M": 100.3406,
    "S": 0.0401
  },
  {
    "type": "height",
    "gender": "M",
    "month": 44,
    "L": -0.4343,
    "M": 100.8881,
    "S": 0.0401
  },
  {
    "type": "height",
    "gender": "M",
    "month": 45,
    "L": -0.3625,
    "M": 101.4353,
    "S": 0.0401
  },
  {
    "type": "height",
    "gender": "M",
    "month": 46,
    "L": -0.2921,
    "M": 101.9824,
    "S": 0.0401
  },
  {
    "type": "height",
    "gender": "M",
    "month": 47,
    "L": -0.2232,
    "M": 102.5294,
    "S": 0.04
  },
  {
    "type": "height",
    "gender": "M",
    "month": 48,
    "L": -0.1597,
    "M": 103.0749,
    "S": 0.04
  },
  {
    "type": "height",
    "gender": "M",
    "month": 49,
    "L": -0.0975,
    "M": 103.6204,
    "S": 0.04
  },
  {
    "type": "height",
    "gender": "M",
    "month": 50,
    "L": -0.0364,
    "M": 104.1657,
    "S": 0.04
  },
  {
    "type": "height",
    "gender": "M",
    "month": 51,
    "L": 0.0234,
    "M": 104.7109,
    "S": 0.0399
  },
  {
    "type": "height",
    "gender": "M",
    "month": 52,
    "L": 0.0822,
    "M": 105.256,
    "S": 0.0399
  },
  {
    "type": "height",
    "gender": "M",
    "month": 53,
    "L": 0.1398,
    "M": 105.8009,
    "S": 0.0399
  },
  {
    "type": "height",
    "gender": "M",
    "month": 54,
    "L": 0.1897,
    "M": 106.344,
    "S": 0.0399
  },
  {
    "type": "height",
    "gender": "M",
    "month": 55,
    "L": 0.2387,
    "M": 106.8869,
    "S": 0.0399
  },
  {
    "type": "height",
    "gender": "M",
    "month": 56,
    "L": 0.2868,
    "M": 107.4298,
    "S": 0.0398
  },
  {
    "type": "height",
    "gender": "M",
    "month": 57,
    "L": 0.3341,
    "M": 107.9726,
    "S": 0.0398
  },
  {
    "type": "height",
    "gender": "M",
    "month": 58,
    "L": 0.3805,
    "M": 108.5153,
    "S": 0.0398
  },
  {
    "type": "height",
    "gender": "M",
    "month": 59,
    "L": 0.4261,
    "M": 109.0579,
    "S": 0.0398
  },
  {
    "type": "height",
    "gender": "M",
    "month": 60,
    "L": 0.4242,
    "M": 109.5896,
    "S": 0.0398
  },
  {
    "type": "height",
    "gender": "M",
    "month": 61,
    "L": 0.4224,
    "M": 110.1212,
    "S": 0.0399
  },
  {
    "type": "height",
    "gender": "M",
    "month": 62,
    "L": 0.4205,
    "M": 110.6529,
    "S": 0.0399
  },
  {
    "type": "height",
    "gender": "M",
    "month": 63,
    "L": 0.4187,
    "M": 111.1846,
    "S": 0.0399
  },
  {
    "type": "height",
    "gender": "M",
    "month": 64,
    "L": 0.4169,
    "M": 111.7162,
    "S": 0.04
  },
  {
    "type": "height",
    "gender": "M",
    "month": 65,
    "L": 0.4151,
    "M": 112.2479,
    "S": 0.04
  },
  {
    "type": "height",
    "gender": "M",
    "month": 66,
    "L": 0.3787,
    "M": 112.7735,
    "S": 0.04
  },
  {
    "type": "height",
    "gender": "M",
    "month": 67,
    "L": 0.3429,
    "M": 113.299,
    "S": 0.0401
  },
  {
    "type": "height",
    "gender": "M",
    "month": 68,
    "L": 0.3074,
    "M": 113.8245,
    "S": 0.0401
  },
  {
    "type": "height",
    "gender": "M",
    "month": 69,
    "L": 0.2724,
    "M": 114.3501,
    "S": 0.0402
  },
  {
    "type": "height",
    "gender": "M",
    "month": 70,
    "L": 0.2378,
    "M": 114.8756,
    "S": 0.0402
  },
  {
    "type": "height",
    "gender": "M",
    "month": 71,
    "L": 0.2036,
    "M": 115.401,
    "S": 0.0403
  },
  {
    "type": "height",
    "gender": "M",
    "month": 72,
    "L": 0.1783,
    "M": 115.9183,
    "S": 0.0403
  },
  {
    "type": "height",
    "gender": "M",
    "month": 73,
    "L": 0.1533,
    "M": 116.4356,
    "S": 0.0404
  },
  {
    "type": "height",
    "gender": "M",
    "month": 74,
    "L": 0.1287,
    "M": 116.9528,
    "S": 0.0404
  },
  {
    "type": "height",
    "gender": "M",
    "month": 75,
    "L": 0.1044,
    "M": 117.4701,
    "S": 0.0405
  },
  {
    "type": "height",
    "gender": "M",
    "month": 76,
    "L": 0.0805,
    "M": 117.9874,
    "S": 0.0405
  },
  {
    "type": "height",
    "gender": "M",
    "month": 77,
    "L": 0.0569,
    "M": 118.5047,
    "S": 0.0406
  },
  {
    "type": "height",
    "gender": "M",
    "month": 78,
    "L": 0.0563,
    "M": 119.0136,
    "S": 0.0406
  },
  {
    "type": "height",
    "gender": "M",
    "month": 79,
    "L": 0.0557,
    "M": 119.5225,
    "S": 0.0406
  },
  {
    "type": "height",
    "gender": "M",
    "month": 80,
    "L": 0.0552,
    "M": 120.0314,
    "S": 0.0406
  },
  {
    "type": "height",
    "gender": "M",
    "month": 81,
    "L": 0.0546,
    "M": 120.5404,
    "S": 0.0406
  },
  {
    "type": "height",
    "gender": "M",
    "month": 82,
    "L": 0.0541,
    "M": 121.0493,
    "S": 0.0406
  },
  {
    "type": "height",
    "gender": "M",
    "month": 83,
    "L": 0.0536,
    "M": 121.5582,
    "S": 0.0406
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 0,
    "L": 0.3809,
    "M": 3.2322,
    "S": 0.1417
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 1,
    "L": 0.1714,
    "M": 4.1873,
    "S": 0.1372
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 2,
    "L": 0.0962,
    "M": 5.1282,
    "S": 0.13
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 3,
    "L": 0.0402,
    "M": 5.8458,
    "S": 0.1262
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 4,
    "L": -0.005,
    "M": 6.4237,
    "S": 0.124
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 5,
    "L": -0.043,
    "M": 6.8985,
    "S": 0.1227
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 6,
    "L": -0.0756,
    "M": 7.297,
    "S": 0.122
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 7,
    "L": -0.1039,
    "M": 7.6422,
    "S": 0.1218
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 8,
    "L": -0.1288,
    "M": 7.9487,
    "S": 0.1218
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 9,
    "L": -0.1507,
    "M": 8.2254,
    "S": 0.122
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 10,
    "L": -0.17,
    "M": 8.48,
    "S": 0.1222
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 11,
    "L": -0.1872,
    "M": 8.7192,
    "S": 0.1225
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 12,
    "L": -0.2024,
    "M": 8.9481,
    "S": 0.1227
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 13,
    "L": -0.2158,
    "M": 9.1699,
    "S": 0.1228
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 14,
    "L": -0.2278,
    "M": 9.387,
    "S": 0.1229
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 15,
    "L": -0.2384,
    "M": 9.6008,
    "S": 0.123
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 16,
    "L": -0.2478,
    "M": 9.8124,
    "S": 0.123
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 17,
    "L": -0.2562,
    "M": 10.0226,
    "S": 0.1231
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 18,
    "L": -0.2637,
    "M": 10.2315,
    "S": 0.1231
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 19,
    "L": -0.2703,
    "M": 10.4393,
    "S": 0.1232
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 20,
    "L": -0.2762,
    "M": 10.6464,
    "S": 0.1232
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 21,
    "L": -0.2815,
    "M": 10.8534,
    "S": 0.1234
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 22,
    "L": -0.2862,
    "M": 11.0608,
    "S": 0.1235
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 23,
    "L": -0.2903,
    "M": 11.2688,
    "S": 0.1237
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 24,
    "L": -0.2941,
    "M": 11.4775,
    "S": 0.1239
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 25,
    "L": -0.2975,
    "M": 11.6864,
    "S": 0.1241
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 26,
    "L": -0.3005,
    "M": 11.8947,
    "S": 0.1244
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 27,
    "L": -0.3032,
    "M": 12.1015,
    "S": 0.1247
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 28,
    "L": -0.3057,
    "M": 12.3059,
    "S": 0.1251
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 29,
    "L": -0.308,
    "M": 12.5073,
    "S": 0.1255
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 30,
    "L": -0.3101,
    "M": 12.7055,
    "S": 0.1259
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 31,
    "L": -0.312,
    "M": 12.9006,
    "S": 0.1263
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 32,
    "L": -0.3138,
    "M": 13.093,
    "S": 0.1268
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 33,
    "L": -0.3155,
    "M": 13.2837,
    "S": 0.1274
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 34,
    "L": -0.3171,
    "M": 13.4731,
    "S": 0.1279
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 35,
    "L": -0.3186,
    "M": 13.6618,
    "S": 0.1286
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 36,
    "L": 0.5656,
    "M": 14.1998,
    "S": 0.0991
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 37,
    "L": 0.4441,
    "M": 14.3701,
    "S": 0.1004
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 38,
    "L": 0.3317,
    "M": 14.5405,
    "S": 0.1017
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 39,
    "L": 0.2276,
    "M": 14.7108,
    "S": 0.103
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 40,
    "L": 0.1312,
    "M": 14.8813,
    "S": 0.1042
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 41,
    "L": 0.042,
    "M": 15.0518,
    "S": 0.1053
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 42,
    "L": -0.0428,
    "M": 15.2236,
    "S": 0.1064
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 43,
    "L": -0.1212,
    "M": 15.3956,
    "S": 0.1075
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 44,
    "L": -0.1938,
    "M": 15.5676,
    "S": 0.1086
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 45,
    "L": -0.2611,
    "M": 15.7399,
    "S": 0.1096
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 46,
    "L": -0.3236,
    "M": 15.9123,
    "S": 0.1105
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 47,
    "L": -0.3816,
    "M": 16.0848,
    "S": 0.1114
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 48,
    "L": -0.4372,
    "M": 16.2585,
    "S": 0.1124
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 49,
    "L": -0.4888,
    "M": 16.4324,
    "S": 0.1133
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 50,
    "L": -0.5367,
    "M": 16.6064,
    "S": 0.1142
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 51,
    "L": -0.5813,
    "M": 16.7806,
    "S": 0.115
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 52,
    "L": -0.6227,
    "M": 16.9549,
    "S": 0.1159
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 53,
    "L": -0.6613,
    "M": 17.1294,
    "S": 0.1167
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 54,
    "L": -0.6987,
    "M": 17.3046,
    "S": 0.1175
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 55,
    "L": -0.7335,
    "M": 17.48,
    "S": 0.1183
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 56,
    "L": -0.766,
    "M": 17.6555,
    "S": 0.119
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 57,
    "L": -0.7962,
    "M": 17.8311,
    "S": 0.1198
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 58,
    "L": -0.8245,
    "M": 18.0069,
    "S": 0.1205
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 59,
    "L": -0.8509,
    "M": 18.1827,
    "S": 0.1212
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 60,
    "L": -0.876,
    "M": 18.3616,
    "S": 0.122
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 61,
    "L": -0.8993,
    "M": 18.5405,
    "S": 0.1228
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 62,
    "L": -0.921,
    "M": 18.7196,
    "S": 0.1236
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 63,
    "L": -0.9412,
    "M": 18.8988,
    "S": 0.1243
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 64,
    "L": -0.96,
    "M": 19.078,
    "S": 0.125
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 65,
    "L": -0.9776,
    "M": 19.2574,
    "S": 0.1258
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 66,
    "L": -0.984,
    "M": 19.4555,
    "S": 0.127
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 67,
    "L": -0.9894,
    "M": 19.6537,
    "S": 0.1281
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 68,
    "L": -0.9941,
    "M": 19.8519,
    "S": 0.1293
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 69,
    "L": -0.9981,
    "M": 20.0502,
    "S": 0.1304
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 70,
    "L": -1.0014,
    "M": 20.2485,
    "S": 0.1315
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 71,
    "L": -1.0041,
    "M": 20.4468,
    "S": 0.1326
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 72,
    "L": -0.9954,
    "M": 20.6619,
    "S": 0.134
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 73,
    "L": -0.9868,
    "M": 20.8769,
    "S": 0.1354
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 74,
    "L": -0.9784,
    "M": 21.092,
    "S": 0.1367
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 75,
    "L": -0.97,
    "M": 21.3071,
    "S": 0.138
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 76,
    "L": -0.9618,
    "M": 21.5221,
    "S": 0.1392
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 77,
    "L": -0.9537,
    "M": 21.7372,
    "S": 0.1405
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 78,
    "L": -0.9411,
    "M": 21.9702,
    "S": 0.1419
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 79,
    "L": -0.9288,
    "M": 22.2032,
    "S": 0.1432
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 80,
    "L": -0.9169,
    "M": 22.4363,
    "S": 0.1445
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 81,
    "L": -0.9054,
    "M": 22.6693,
    "S": 0.1459
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 82,
    "L": -0.8942,
    "M": 22.9023,
    "S": 0.1471
  },
  {
    "type": "weight",
    "gender": "F",
    "month": 83,
    "L": -0.8833,
    "M": 23.1353,
    "S": 0.1484
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 0,
    "L": 0.3487,
    "M": 3.3464,
    "S": 0.146
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 1,
    "L": 0.2297,
    "M": 4.4709,
    "S": 0.134
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 2,
    "L": 0.197,
    "M": 5.5675,
    "S": 0.1239
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 3,
    "L": 0.1738,
    "M": 6.3762,
    "S": 0.1173
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 4,
    "L": 0.1553,
    "M": 7.0023,
    "S": 0.1132
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 5,
    "L": 0.1395,
    "M": 7.5105,
    "S": 0.1108
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 6,
    "L": 0.1257,
    "M": 7.934,
    "S": 0.1096
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 7,
    "L": 0.1134,
    "M": 8.297,
    "S": 0.109
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 8,
    "L": 0.1021,
    "M": 8.6151,
    "S": 0.1088
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 9,
    "L": 0.0917,
    "M": 8.9014,
    "S": 0.1088
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 10,
    "L": 0.082,
    "M": 9.1649,
    "S": 0.1089
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 11,
    "L": 0.073,
    "M": 9.4122,
    "S": 0.1091
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 12,
    "L": 0.0644,
    "M": 9.6479,
    "S": 0.1093
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 13,
    "L": 0.0563,
    "M": 9.8749,
    "S": 0.1095
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 14,
    "L": 0.0487,
    "M": 10.0953,
    "S": 0.1098
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 15,
    "L": 0.0413,
    "M": 10.3108,
    "S": 0.1101
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 16,
    "L": 0.0343,
    "M": 10.5228,
    "S": 0.1104
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 17,
    "L": 0.0275,
    "M": 10.7319,
    "S": 0.1108
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 18,
    "L": 0.0211,
    "M": 10.9385,
    "S": 0.1112
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 19,
    "L": 0.0148,
    "M": 11.143,
    "S": 0.1116
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 20,
    "L": 0.0087,
    "M": 11.3462,
    "S": 0.1121
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 21,
    "L": 0.0029,
    "M": 11.5486,
    "S": 0.1126
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 22,
    "L": -0.0028,
    "M": 11.7504,
    "S": 0.1131
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 23,
    "L": -0.0083,
    "M": 11.9514,
    "S": 0.1137
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 24,
    "L": -0.0137,
    "M": 12.1515,
    "S": 0.1143
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 25,
    "L": -0.0189,
    "M": 12.3502,
    "S": 0.1149
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 26,
    "L": -0.024,
    "M": 12.5466,
    "S": 0.1154
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 27,
    "L": -0.0289,
    "M": 12.7401,
    "S": 0.116
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 28,
    "L": -0.0337,
    "M": 12.9303,
    "S": 0.1166
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 29,
    "L": -0.0385,
    "M": 13.1169,
    "S": 0.1172
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 30,
    "L": -0.0431,
    "M": 13.3,
    "S": 0.1178
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 31,
    "L": -0.0476,
    "M": 13.4798,
    "S": 0.1184
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 32,
    "L": -0.052,
    "M": 13.6567,
    "S": 0.119
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 33,
    "L": -0.0564,
    "M": 13.8309,
    "S": 0.1195
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 34,
    "L": -0.0606,
    "M": 14.0031,
    "S": 0.1201
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 35,
    "L": -0.0648,
    "M": 14.1736,
    "S": 0.1206
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 36,
    "L": 0.0567,
    "M": 14.7381,
    "S": 0.0969
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 37,
    "L": -0.0147,
    "M": 14.911,
    "S": 0.0981
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 38,
    "L": -0.0804,
    "M": 15.0839,
    "S": 0.0994
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 39,
    "L": -0.1409,
    "M": 15.2569,
    "S": 0.1005
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 40,
    "L": -0.1966,
    "M": 15.4299,
    "S": 0.1016
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 41,
    "L": -0.2481,
    "M": 15.603,
    "S": 0.1027
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 42,
    "L": -0.299,
    "M": 15.7775,
    "S": 0.1038
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 43,
    "L": -0.3461,
    "M": 15.9521,
    "S": 0.1049
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 44,
    "L": -0.3895,
    "M": 16.1268,
    "S": 0.106
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 45,
    "L": -0.4297,
    "M": 16.3015,
    "S": 0.107
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 46,
    "L": -0.4669,
    "M": 16.4763,
    "S": 0.108
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 47,
    "L": -0.5013,
    "M": 16.6512,
    "S": 0.1089
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 48,
    "L": -0.5361,
    "M": 16.8276,
    "S": 0.1099
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 49,
    "L": -0.5684,
    "M": 17.0041,
    "S": 0.1109
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 50,
    "L": -0.5983,
    "M": 17.1807,
    "S": 0.1118
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 51,
    "L": -0.6261,
    "M": 17.3573,
    "S": 0.1127
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 52,
    "L": -0.6518,
    "M": 17.534,
    "S": 0.1136
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 53,
    "L": -0.6758,
    "M": 17.7108,
    "S": 0.1144
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 54,
    "L": -0.6999,
    "M": 17.8888,
    "S": 0.1153
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 55,
    "L": -0.7222,
    "M": 18.067,
    "S": 0.1162
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 56,
    "L": -0.743,
    "M": 18.2452,
    "S": 0.117
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 57,
    "L": -0.7623,
    "M": 18.4235,
    "S": 0.1178
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 58,
    "L": -0.7803,
    "M": 18.6018,
    "S": 0.1186
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 59,
    "L": -0.7971,
    "M": 18.7802,
    "S": 0.1194
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 60,
    "L": -0.8162,
    "M": 18.9625,
    "S": 0.1202
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 61,
    "L": -0.8339,
    "M": 19.1449,
    "S": 0.1211
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 62,
    "L": -0.8503,
    "M": 19.3274,
    "S": 0.1219
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 63,
    "L": -0.8655,
    "M": 19.51,
    "S": 0.1227
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 64,
    "L": -0.8797,
    "M": 19.6926,
    "S": 0.1235
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 65,
    "L": -0.893,
    "M": 19.8753,
    "S": 0.1242
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 66,
    "L": -0.9106,
    "M": 20.0814,
    "S": 0.1254
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 67,
    "L": -0.9264,
    "M": 20.2877,
    "S": 0.1265
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 68,
    "L": -0.9407,
    "M": 20.4941,
    "S": 0.1275
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 69,
    "L": -0.9536,
    "M": 20.7007,
    "S": 0.1286
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 70,
    "L": -0.9653,
    "M": 20.9073,
    "S": 0.1296
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 71,
    "L": -0.9757,
    "M": 21.1141,
    "S": 0.1306
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 72,
    "L": -0.9753,
    "M": 21.3417,
    "S": 0.1318
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 73,
    "L": -0.9743,
    "M": 21.5693,
    "S": 0.133
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 74,
    "L": -0.973,
    "M": 21.797,
    "S": 0.1342
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 75,
    "L": -0.9714,
    "M": 22.0247,
    "S": 0.1353
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 76,
    "L": -0.9694,
    "M": 22.2524,
    "S": 0.1364
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 77,
    "L": -0.9672,
    "M": 22.4802,
    "S": 0.1375
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 78,
    "L": -0.9576,
    "M": 22.7267,
    "S": 0.1388
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 79,
    "L": -0.9481,
    "M": 22.9732,
    "S": 0.14
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 80,
    "L": -0.9388,
    "M": 23.2196,
    "S": 0.1412
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 81,
    "L": -0.9298,
    "M": 23.4661,
    "S": 0.1424
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 82,
    "L": -0.921,
    "M": 23.7126,
    "S": 0.1436
  },
  {
    "type": "weight",
    "gender": "M",
    "month": 83,
    "L": -0.9124,
    "M": 23.9591,
    "S": 0.1447
  }
];

export function findGrowthLMS(type: GrowthMetric, gender: GrowthGender, month: number): GrowthLMS | undefined {
  const normalizedMonth = Math.max(0, Math.min(83, Math.round(month)));
  return growthLMS.find((row) => row.type === type && row.gender === gender && row.month === normalizedMonth);
}

function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  const absX = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * absX);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-absX * absX);
  return sign * y;
}

export function normalCDF(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

export function calcPercentile(X: number, L: number, M: number, S: number): number {
  if (!Number.isFinite(X) || X <= 0 || !Number.isFinite(M) || M <= 0 || !Number.isFinite(S) || S <= 0) return 0;
  const z = L === 0 ? Math.log(X / M) / S : (Math.pow(X / M, L) - 1) / (L * S);
  return Math.max(0, Math.min(100, Math.round(normalCDF(z) * 100)));
}

export function calcGrowthPercentile(type: GrowthMetric, gender: GrowthGender, month: number, value: number): number | null {
  const lms = findGrowthLMS(type, gender, month);
  if (!lms || !Number.isFinite(value) || value <= 0) return null;
  return calcPercentile(value, lms.L, lms.M, lms.S);
}
