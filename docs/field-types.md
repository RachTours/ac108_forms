# ReviewRoom form field support matrix

This matrix records where each persisted field type is supported. The authoring schema is shared by the form builder, API validation, public reviewer form, and submission history. Definitions are stored as JSON snapshots; adding a discriminant does not require a relational migration.

| Field | Builder palette/settings/preview | Reviewer input | API answer validation | Historical submission view |
|---|---|---|---|---|
| Short text | Yes; min/max character settings | Text input | Trims, then checks length bounds | Displays the stored string |
| Long text | Yes; min/max character settings | Text area | Trims, then checks length bounds | Displays the stored string |
| Email | Yes | Email input | Validates, lowercases, limits to 254 chars | Displays the stored address |
| Number | Yes; optional min/max | Number input | Requires finite number and checks bounds | Displays the stored number |
| Multiple choice | Yes; options editable | Single-select radios | Requires an option ID from this question | Resolves ID to the saved option label |
| Checkboxes | Yes; options and selection bounds | Multi-select checkboxes | Enforces unique known IDs and min/max counts | Resolves IDs to saved option labels |
| Dropdown | Yes; options editable | Single-select dropdown | Requires an option ID from this question | Resolves ID to the saved option label |
| Rating scale | Yes; min/max/step; preview summarizes larger ranges | Buttons for up to 21 values; numeric input for larger ranges | Requires an integer in range on the configured step | Displays the stored number |
| Date | Yes; optional earliest/latest date | Date input | Parses ISO date and checks configured bounds | Displays the stored date |
| Consent | Yes; consent statement | Checkbox | Accepts only true; optional false is treated as unanswered | Displays accepted state |
| Ranking | Yes; options and instruction | Arrow-reordered list with no rank numbers | Requires every known option ID exactly once | Resolves order to the saved labels |
| Website / URL | Yes | URL input | Accepts absolute HTTP or HTTPS URLs only, bounded to 2048 characters | Displays the saved URL as text |
| Phone number | Yes | Telephone input; punctuation and + accepted | Requires 7–15 digits and stores a trimmed canonical digit string, preserving a leading + | Displays the canonical phone string |
| Yes / No | Yes | Native radio choices | Requires a boolean; false is a valid “No” response | Displays “Yes” or “No” |

## Validation behavior

- Optional empty strings (including whitespace-only strings) are omitted for all string-valued fields. Required whitespace-only answers produce the same required-answer error as a missing value.
- Optional empty checkbox/ranking arrays are omitted. Required empty arrays are reported as missing.
- An unchecked optional consent answer is omitted; a checked required consent answer must be true.
- Checkbox minimum and maximum selections cannot exceed the available options.
- Choice IDs are checked against the options on that exact published form version.
- Rating scale step must be positive and land exactly on its maximum. Large ranges use a numeric input instead of creating an unbounded number of controls.
- Existing persisted field discriminants remain unchanged, so old draft and published JSON definitions continue to parse.

## Field-type research and scope decision

Google Forms' official field guide documents short answer, paragraph, multiple choice, checkboxes, dropdown, linear scale, rating, date, time, grids, and file uploads. Typeform's official question guide also documents phone number, website, yes/no, ranking, matrix, and other specialized interactions. ReviewRoom already covers the most relevant core set; this pass adds website, phone, and yes/no, which need only bounded scalar answers and fit the existing JSON answer model.

Matrix/grid questions, file upload, address, signatures, payments, NPS reporting, time, and informational section blocks remain separate product decisions. In particular, file upload requires private storage, authorized upload/download access, size/type limits, malware scanning, retention, and deletion behavior; it should not be added as a simple input control.

## Sources

- [Google Forms question types](https://support.google.com/docs/answer/7322334)
- [Typeform question types](https://help.typeform.com/hc/en-us/articles/360051789692-Question-types)
