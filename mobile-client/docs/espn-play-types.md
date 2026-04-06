# ESPN NBA play types (`type.id` / `type.text`)

This catalog lists **`type.text`** labels observed from the Site API v2 **`summary?event=`** plays array, grouped for visualization and product logic. Each line includes ESPN’s **`type.id`** where known.

**Source:** Distinct types collected across **25 recent NBA games** (same endpoint as [`lib/api/espn-live.ts`](../lib/api/espn-live.ts)). ESPN can add or rename labels over time; treat rare buckets as open-ended and keep an **Other / uncategorized** path in UI.

---

## Meta / game flow


| `type.id` | `type.text`  |
| --------- | ------------ |
| `615`     | Jumpball     |
| `16`      | Full Timeout |
| `584`     | Substitution |
| `412`     | End Period   |
| `402`     | End Game     |


---

## Fouls & violations


| `type.id` | `type.text`                   |
| --------- | ----------------------------- |
| `45`      | Personal Foul                 |
| `44`      | Shooting Foul                 |
| `22`      | Personal Take Foul            |
| `257`     | Transition Take Foul          |
| `43`      | Loose Ball Foul               |
| `42`      | Offensive Foul                |
| `24`      | Offensive Charge              |
| `84`      | Offensive Foul Turnover       |
| `37`      | Clear Path Foul               |
| `32`      | Flagrant Foul Type 1          |
| `31`      | Flagrant Foul Type 2          |
| `36`      | Double Personal Foul          |
| `35`      | Technical Foul                |
| `29`      | Defensive 3-Seconds Technical |
| `8`       | Delay of Game                 |
| `12`      | Kicked Ball                   |
| `10`      | Lane                          |
| `9`       | Defensive Goaltending         |
| `517`     | Ejection                      |

*Defensive goaltending* is a **violation** (not a personal foul, but rule enforcement). *Ejection* is **discipline** (often follows fouls or unsportsmanlike conduct). Both belong here for “whistle / rules”-style visualization; they are **rare** compared with personal or shooting fouls.

---

## Reviews / challenges


| `type.id` | `type.text`                       |
| --------- | --------------------------------- |
| `213`     | Challenge                         |
| `214`     | Coach's Challenge (Supported)     |
| `215`     | Coach's Challenge (Overturned)    |
| `216`     | Coach's Challenge (Stands)        |
| `277`     | Coach's Challenge (replaycenter)  |
| `278`     | Ref-Initiated Review (Supported)  |
| `279`     | Ref-Initiated Review (Overturned) |
| `280`     | Ref-Initiated Review (Stands)     |


---

## Turnovers

Some API values include a **literal newline** in `type.text` (e.g. `Bad Pass` + newline + `Turnover`). Normalize for matching: `type.text.replace(/\r?\n/g, ' ')`.


| `type.id` | `type.text`                        |
| --------- | ---------------------------------- |
| `62`      | Bad Pass\nTurnover                 |
| `63`      | Lost Ball Turnover                 |
| `64`      | Traveling                          |
| `65`      | Double Dribble Turnover            |
| `70`      | Shot Clock Turnover                |
| `72`      | Back Court Turnover                |
| `73`      | Offensive Goaltending Turnover     |
| `74`      | Lane Violation Turnover            |
| `78`      | Palming Turnover                   |
| `86`      | Out of Bounds - Step Turnover      |
| `87`      | Out of Bounds - Lost Ball Turnover |
| `90`      | Out of Bounds - Bad Pass Turnover  |


---

## Rebounds


| `type.id` | `type.text`       |
| --------- | ----------------- |
| `155`     | Defensive Rebound |
| `156`     | Offensive Rebound |


---

## Free throws


| `type.id` | `type.text`                    |
| --------- | ------------------------------ |
| `97`      | Free Throw - 1 of 1            |
| `98`      | Free Throw - 1 of 2            |
| `99`      | Free Throw - 2 of 2            |
| `100`     | Free Throw - 1 of 3            |
| `101`     | Free Throw - 2 of 3            |
| `102`     | Free Throw - 3 of 3            |
| `103`     | Free Throw - Technical         |
| `104`     | Free Throw - Flagrant 1 of 2   |
| `105`     | Free Throw - Flagrant 2 of 2   |
| `107`     | Free Throw - Clear Path 1 of 2 |
| `108`     | Free Throw - Clear Path 2 of 2 |


---

## Field goals (shot style / motion)

Scoring vs miss is **not** in `type.text` alone; use `scoringPlay`, `shootingPlay`, `scoreValue`, and running scores as in the raw play object.


| `type.id` | `type.text`                        |
| --------- | ---------------------------------- |
| `92`      | Jump Shot                          |
| `93`      | Hook Shot                          |
| `94`      | Tip Shot                           |
| `95`      | Layup Shot                         |
| `96`      | Dunk Shot                          |
| `109`     | Running Layup Shot                 |
| `110`     | Driving Layup Shot                 |
| `111`     | Alley Oop Layup Shot               |
| `112`     | Reverse Layup Shot                 |
| `113`     | Running Jump Shot                  |
| `114`     | Turnaround Jump Shot               |
| `115`     | Driving Dunk Shot                  |
| `116`     | Running Dunk Shot                  |
| `118`     | Alley Oop Dunk Shot                |
| `119`     | Driving Hook Shot                  |
| `120`     | Turnaround Hook Shot               |
| `121`     | Fade Away Jump Shot                |
| `122`     | Jump Shot Bank                     |
| `123`     | Hook Shot Bank                     |
| `124`     | Finger Roll Layup                  |
| `125`     | Layup Shot Putback                 |
| `126`     | Layup Driving Reverse              |
| `127`     | Layup Running Reverse              |
| `128`     | Driving Finger Roll Layup          |
| `129`     | Running Finger Roll Layup          |
| `130`     | Floating Jump Shot                 |
| `131`     | Pullup Jump Shot                   |
| `132`     | Step Back Jump Shot                |
| `133`     | Pullup Bank Jump Shot              |
| `134`     | Driving Jump Shot Bank             |
| `135`     | Fade Away Bank Jump Shot           |
| `137`     | Turnaround Fade Away Jump Shot     |
| `138`     | Putback Dunk Shot                  |
| `139`     | Hook Driving Bank                  |
| `140`     | Hook Turnaround Bank               |
| `141`     | Cutting Layup Shot                 |
| `142`     | Cutting Finger Roll Layup Shot     |
| `143`     | Running Alley Oop Layup Shot       |
| `144`     | Driving Floating Jump Shot         |
| `145`     | Driving Floating Bank Jump Shot    |
| `146`     | Running Pullup Jump Shot           |
| `148`     | Turnaround Fadeaway Bank Jump Shot |
| `150`     | Tip Dunk Shot                      |
| `151`     | Cutting Dunk Shot                  |
| `282`     | Heave Jump Shot                    |


---

## Should you expect anything outside these sections?

**Yes, in a few senses:**

1. **Unsampled or future labels** — This list is **empirical**, not an official ESPN enum. Over a full season, playoffs, or rule changes, **new `type.text` strings** or **new `type.id` values** can appear. Your viz should treat unknown `type.id` / `type.text` as **Other** and optionally log them.
2. **Same logical event, different buckets** — Example: **Offensive Foul Turnover** is both foul-flavored and turnover-flavored. For charts, pick **one primary category** (often turnover for pace/tempo viz, foul for whistle density).
3. **Classification is clearer with flags than with `type.text` alone** — For engagement (colors, icons, animations), combining **`type.id`** (or normalized **`type.text`**) with **`scoringPlay`**, **`shootingPlay`**, and **`scoreValue`** is more reliable than parsing prose.
4. **“Shot” vs “FT” vs “and-one” flow** — Sequences are **multiple plays** (foul → FT lines). Each row is one API play; story arcs are **chains**, not single types.
5. **Optional seventh bucket** — Many products add **Stoppages / admin**: timeouts, substitutions, replay/challenge outcomes, end period, end game. Those are already under **Meta / game flow** and **Reviews** here; you can split **“Clock stoppage”** (timeout, challenge, injury not in this sample) visually if needed.

**Bottom line:** The section headers cover **almost everything in typical NBA feeds**, but **design for extensibility**: unknown type → neutral styling; prefer **`type.id`** when stable, fall back to normalized **`type.text`**.

---

## Related code

- Raw mapping: [`lib/api/espn-live.ts`](../lib/api/espn-live.ts) (`ESPNPlay`, `mapESPNPlaysToPlayByPlayRecord`)
- Stat deltas / heuristics on `type_text`: [`lib/utils/live-stats.ts`](../lib/utils/live-stats.ts)
- Sample raw JSON: [espn-play-by-play-sample.md](./espn-play-by-play-sample.md)

