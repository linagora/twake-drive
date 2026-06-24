/**
 * scribeResponse.fixtures.js — Static malformed-response regression corpus.
 *
 * A deterministic, network-free catalogue of the malformed LLM responses
 * `parseScribeResponse` must tolerate, grouped by the SIX D-07 categories:
 *
 *   - `fence`          ```json-wrapped valid JSON (the ~2% fellBack reliquat)
 *   - `preamble`       localized prose preface, then the JSON object
 *   - `trailingComma`  a stray comma before `}` / `]`
 *   - `splitTable`     unbalanced [TABLE:N] / [CELL:r,c] structure markers
 *   - `brokenRef`      a malformed {{REF:scribe-ref-N:…}} / [^scribe-fn-N] marker
 *   - `nonJsonProse`   pure prose, no JSON object at all
 *
 * This corpus is intentionally SEPARATE from the live GATE measurement harness
 * (under scripts/, which measures the real model) and from the
 * single-example parser spec (`scribeResponse.spec.js`). It uses ONLY static
 * string literals — no network, no model, no harness import — so the regression
 * suite is fully reproducible.
 *
 * Each fixture is `{ name, raw, surface, expect }` where `expect` documents the
 * asserted `parseScribeResponse` outcome. At minimum `expect.fellBack` and
 * `expect.valid` are set; optional `discussion`, `fragments`, `warningsInclude`,
 * and `fragmentsContain` describe deeper assertions the corpus spec enforces.
 *
 * Authoring note (D-08 anchor): the `fence` category includes a VERBATIM copy of
 * the real model-emitted reliquat observed in STATE.md (the ```json-wrapped
 * payload that produced the ~2% fellBack tail). It is tagged in its `name` as the
 * real-world sample so the fence re-measure is anchored to reality, not only to
 * author-invented shapes the existing stripFence happens to already handle.
 *
 * @type {Object<string, Array<{
 *   name: string,
 *   raw: string,
 *   surface: ('chat'|'popover'),
 *   expect: {
 *     fellBack: boolean,
 *     valid: boolean,
 *     discussion?: string,
 *     fragments?: string[],
 *     warningsInclude?: string[],
 *     fragmentsContain?: string[]
 *   }
 * }>>}
 */
export const SCRIBE_RESPONSE_FIXTURES = {
  // ---------------------------------------------------------------------------
  // 1. fence — ```json-wrapped valid JSON. A fence-only defect must ALWAYS parse
  // (fellBack === false); it is never a fallback. Covers the 3 shapes the model
  // emits plus the verbatim real-world reliquat from STATE.md.
  // ---------------------------------------------------------------------------
  fence: [
    {
      name: 'fence: ```json + language tag, standard newlines',
      raw: '```json\n{"discussion":"Voici la reformulation.","fragments":["Le chat dort."]}\n```',
      surface: 'chat',
      expect: {
        fellBack: false,
        valid: true,
        discussion: 'Voici la reformulation.',
        fragments: ['Le chat dort.']
      }
    },
    {
      name: 'fence: ```json + trailing whitespace and blank lines after the object',
      raw: '```json\n{"discussion":"hi","fragments":["a"]}\n\n   \n```  \n',
      surface: 'chat',
      expect: {
        fellBack: false,
        valid: true,
        discussion: 'hi',
        fragments: ['a']
      }
    },
    {
      name: 'fence: ```json with NO trailing newline before the closing ```',
      raw: '```json\n{"discussion":"done","fragments":[]}```',
      surface: 'chat',
      expect: {
        fellBack: false,
        valid: true,
        discussion: 'done',
        fragments: []
      }
    },
    {
      name: 'fence: bare ``` fence with no language tag',
      raw: '```\n{"discussion":"plain fence","fragments":["x"]}\n```',
      surface: 'chat',
      expect: {
        fellBack: false,
        valid: true,
        discussion: 'plain fence',
        fragments: ['x']
      }
    },
    {
      // VERBATIM real-world reliquat — the exact ```json-wrapped shape observed in
      // STATE.md ("~2% fellBack (model wraps JSON in a ```json fence)"). This
      // anchors the 0% re-measure to a real model output, not only invented ones.
      name: 'fence: VERBATIM real-reliquat sample observed in STATE.md (model wraps JSON in a ```json fence)',
      raw: '```json\n{"discussion":"J\'ai reformulé le passage pour plus de clarté. {{fragment:0}}","fragments":["Le chat dort paisiblement sur le canapé."]}\n```',
      surface: 'popover',
      expect: {
        fellBack: false,
        valid: true,
        discussion:
          "J'ai reformulé le passage pour plus de clarté. {{fragment:0}}",
        fragments: ['Le chat dort paisiblement sur le canapé.']
      }
    }
  ],

  // ---------------------------------------------------------------------------
  // 2. preamble — localized prose preface, then the JSON object. The tolerant
  // pipeline extracts the first balanced object, so these parse (fellBack false).
  // ---------------------------------------------------------------------------
  preamble: [
    {
      name: 'preamble (fr): French prose before the JSON object',
      raw:
        'Bien sûr, voici la réponse demandée :\n{"discussion":"Reformulé.","fragments":["Le texte corrigé."]}',
      surface: 'chat',
      expect: {
        fellBack: false,
        valid: true,
        discussion: 'Reformulé.',
        fragments: ['Le texte corrigé.']
      }
    },
    {
      name: 'preamble (en): English prose before the JSON object',
      raw:
        'Sure! Here is the structured result you asked for:\n{"discussion":"Rewritten.","fragments":["The corrected text."]}',
      surface: 'chat',
      expect: {
        fellBack: false,
        valid: true,
        discussion: 'Rewritten.',
        fragments: ['The corrected text.']
      }
    },
    {
      name: 'preamble (en): prose before AND after the JSON object',
      raw:
        'Here you go: {"discussion":"d","fragments":["frag"]} Let me know if you want changes!',
      surface: 'popover',
      expect: {
        fellBack: false,
        valid: true,
        discussion: 'd',
        fragments: ['frag']
      }
    }
  ],

  // ---------------------------------------------------------------------------
  // 3. trailingComma — a stray comma before `}` / `]`, repaired by the tolerant
  // pipeline (fellBack false).
  // ---------------------------------------------------------------------------
  trailingComma: [
    {
      name: 'trailingComma: comma before both ] and }',
      raw: '{"discussion":"x","fragments":["a",],}',
      surface: 'chat',
      expect: {
        fellBack: false,
        valid: true,
        discussion: 'x',
        fragments: ['a']
      }
    },
    {
      name: 'trailingComma: comma before } only, no fragments array',
      raw: '{"discussion":"only discussion",}',
      surface: 'chat',
      expect: {
        fellBack: false,
        valid: true,
        discussion: 'only discussion',
        fragments: []
      }
    },
    {
      name: 'trailingComma: comma before ] inside a multi-element fragments array',
      raw: '{"discussion":"d","fragments":["a","b",]}',
      surface: 'popover',
      expect: {
        fellBack: false,
        valid: true,
        discussion: 'd',
        fragments: ['a', 'b']
      }
    }
  ],

  // ---------------------------------------------------------------------------
  // 4. splitTable — unbalanced [TABLE:N] / [CELL:r,c] markers inside a fragment.
  // JSON parses, but the split-structure guard sets valid:false + 'split-table'.
  // ---------------------------------------------------------------------------
  splitTable: [
    {
      name: 'splitTable: orphan opening [TABLE:0] with no [/TABLE]',
      raw: '{"discussion":"d","fragments":["before [TABLE:0] orphan"]}',
      surface: 'chat',
      expect: {
        fellBack: false,
        valid: false,
        warningsInclude: ['split-table']
      }
    },
    {
      name: 'splitTable: stray closing [/CELL] with no opening [CELL:r,c]',
      raw: '{"discussion":"d","fragments":["dangling [/CELL] here"]}',
      surface: 'chat',
      expect: {
        fellBack: false,
        valid: false,
        warningsInclude: ['split-table']
      }
    },
    {
      name: 'splitTable: a cell opened but its table never closed',
      raw:
        '{"discussion":"d","fragments":["[TABLE:1][CELL:0,0]x[/CELL]"]}',
      surface: 'popover',
      expect: {
        fellBack: false,
        valid: false,
        warningsInclude: ['split-table']
      }
    }
  ],

  // ---------------------------------------------------------------------------
  // 5. brokenRef — a fragment containing a malformed {{REF:scribe-ref-N:…}} or
  // [^scribe-fn-N] marker. The parser preserves fragment bodies verbatim and does
  // NOT validate REF/footnote well-formedness (D-02: REF integrity is out of this
  // phase's trigger), so JSON parses cleanly (fellBack false, valid true) and the
  // malformed marker survives byte-for-byte in the fragment body.
  // ---------------------------------------------------------------------------
  brokenRef: [
    {
      name: 'brokenRef: {{REF:scribe-ref-3 …}} missing its closing }} — preserved verbatim',
      raw:
        '{"discussion":"see the note","fragments":["voir {{REF:scribe-ref-3:la section"]}',
      surface: 'chat',
      expect: {
        fellBack: false,
        valid: true,
        fragmentsContain: ['{{REF:scribe-ref-3:la section']
      }
    },
    {
      name: 'brokenRef: a footnote marker [^scribe-fn-2 missing its closing ] — preserved verbatim',
      raw:
        '{"discussion":"d","fragments":["a claim[^scribe-fn-2 with no closing bracket"]}',
      surface: 'chat',
      expect: {
        fellBack: false,
        valid: true,
        fragmentsContain: ['[^scribe-fn-2 with no closing bracket']
      }
    },
    {
      name: 'brokenRef: a well-formed {{REF:scribe-ref-7:link}} is preserved untouched (control)',
      raw:
        '{"discussion":"d","fragments":["see {{REF:scribe-ref-7:link}} here"]}',
      surface: 'popover',
      expect: {
        fellBack: false,
        valid: true,
        fragmentsContain: ['{{REF:scribe-ref-7:link}}']
      }
    }
  ],

  // ---------------------------------------------------------------------------
  // 6. nonJsonProse — pure prose, no JSON object. The tolerant pipeline finds
  // nothing parseable and buildFallback runs (fellBack true). Surface-specific:
  // popover → fragments=[raw], discussion=''; chat → discussion=raw, fragments=[].
  // ---------------------------------------------------------------------------
  nonJsonProse: [
    {
      name: 'nonJsonProse (en, chat): plain English prose, no JSON',
      raw: 'I cannot help with that request right now.',
      surface: 'chat',
      expect: {
        fellBack: true,
        valid: false,
        discussion: 'I cannot help with that request right now.',
        fragments: []
      }
    },
    {
      name: 'nonJsonProse (fr, popover): plain French prose, no JSON',
      raw: 'Voici une réponse en texte libre, sans aucun objet JSON.',
      surface: 'popover',
      expect: {
        fellBack: true,
        valid: false,
        discussion: '',
        fragments: ['Voici une réponse en texte libre, sans aucun objet JSON.']
      }
    },
    {
      name: 'nonJsonProse (chat): a bare JSON array is not a contract object → fallback',
      raw: '["this","is","an","array","not","an","object"]',
      surface: 'chat',
      expect: {
        fellBack: true,
        valid: false,
        discussion: '["this","is","an","array","not","an","object"]',
        fragments: []
      }
    }
  ]
}
