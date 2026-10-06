# Spell chain audit

Run `node WhatsTraining_Turtle/tests/check-chains.cjs` from the AddOns directory.
The test reads the class data directly and checks all nine classes for missing
ranks, prerequisite cycles, links to anything other than the preceding rank,
level and racial conflicts, and incomplete or invalid overwritten-rank lists.
Mind-numbing Poison's II/III name suffixes belong to the same rank chain.
Multiple IDs sharing a spell name and rank remain separate records; they now
require the preceding rank rather than another ID of their own rank. The addon
already recognizes every matching ID when it scans the spellbook.

The October 5, 2026 audit passes for 1,461 spell records, 269 ranked spell
families, 980 prerequisite links, and 213 overwritten-rank lists.

Changes made in this audit:

- Corrected 38 prerequisite records across Druid, Hunter, Paladin, Priest,
  Rogue, Shaman, and Warlock. Mage's earlier Frostbolt/Fireball corrections
  were checked again.
- Added missing Holy Light rank 5, Curse of Agony rank 2, Judgement of the
  Crusader rank 1, and Steady Shot ranks 1–5. IDs, names, ranks, and levels
  were checked against `DBFilesClient\Spell.dbc` extracted read-only from
  the installed client's `Data\patch-5.mpq`.
- Removed four unreachable override entries whose source IDs were absent
  from the class lists: Hunter 1528, Paladin 19998/21084, Warrior 7377.
- Corrected Slam's rank 2–5 override lists to remove self-references and
  repeated IDs while retaining every earlier rank.

Explicit exceptions and limits:

- Dire Bear Form replaces Bear Form; this is an intentional cross-name
  override, not a ranked chain.
- `zzOLD Pummel` (6554) remains an isolated obsolete record. It is not
  treated as rank 2 of the current, unranked Pummel (6552).
- This checks the addon data, not live server trainer offerings. The client
  also contains old or deprecated spell records, so their presence alone
  does not establish that a trainer currently teaches them.
- The client comparison separately found older name/rank metadata for
  Aspect of the Fox (45651), Lightwell (724), Lightwell Renew (7001), and
  deprecated Lightwell ranks (27870/27871/51458). These are not rank-link
  errors and were left unchanged in this audit. They require a separate
  review of the server's current spell offerings.
