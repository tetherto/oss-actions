const { MIN_CODEOWNER, checkApproved } = require("../approval");

test("MIN_CODEOWNER is always 1", () => {
  expect(MIN_CODEOWNER).toBe(1);
});

describe("checkApproved", () => {
  test.each([
    ["all zero",                             0, 0, 0,  2, false],

    ["1 management only",                    1, 0, 0,  2, false],
    ["1 team lead only",                     0, 1, 0,  2, false],
    ["1 member only",                        0, 0, 1,  2, false],

    ["2 management",                         2, 0, 0,  2, true ],
    ["2 team leads",                         0, 2, 0,  2, true ],
    ["2 members (no codeowner)",             0, 0, 2,  2, false],

    ["1 management + 1 team lead",           1, 1, 0,  2, true ],
    ["1 management + 1 member",              1, 0, 1,  2, true ],
    ["1 team lead + 1 member",               0, 1, 1,  2, true ],

    ["1 of each",                            1, 1, 1,  2, true ],

    ["2 of each",                            2, 2, 2,  2, true ],

    ["minTotal=3: 1 mgmt + 1 TL (short)",    1, 1, 0,  3, false],
    ["minTotal=3: 1 of each",                1, 1, 1,  3, true ],
    ["minTotal=3: 3 management",             3, 0, 0,  3, true ],
    ["minTotal=3: 1 TL + 2 members",         0, 1, 2,  3, true ],
    ["minTotal=3: 3 members (no codeowner)", 0, 0, 3,  3, false],
  ])("%s → %s", (_, maintainer, teamLead, other, minTotal, expected) => {
    expect(checkApproved({ maintainer, teamLead, other }, minTotal)).toBe(expected);
  });
});
