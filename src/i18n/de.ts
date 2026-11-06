// Structure adapted from math-tank src/i18n/de.ts.
/**
 * German translation table. Source of truth for message keys: another language adds a file of type `Messages` with
 * the same shape. Texts follow contracts/screens.md. Child-facing sections (see CHILD_SECTIONS in index.ts) must
 * never contain a word from `forbiddenWords` (FR-023).
 */

/** "1 Tor" or "n Tore". */
function goalCount(n: number): string {
  return n === 1 ? '1 Tor' : `${n} Tore`;
}

/** "1 Stern" or "n Sterne". */
function starCount(n: number): string {
  return n === 1 ? '1 Stern' : `${n} Sterne`;
}

/** Minutes and seconds, "5:40". */
function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const s = total % 60;
  return `${Math.floor(total / 60)}:${s < 10 ? '0' : ''}${s}`;
}

export const de = {
  appName: 'Mathe-Kicker',

  /** Start screen (contracts/screens.md "Start"). */
  start: {
    modes: { holes: 'Löcher', lines: 'Reihen', keeper: 'Torwart' },
    lockerRoom: 'Kabine',
    stars: (n: number) => `★ ${n}`,
    starsLabel: starCount,
    fullscreen: 'Vollbild',
    gear: 'Für Eltern',
    parentHint: 'Für Eltern: Zahnrad gedrückt halten',
    /** Spoken once on the start tap, so tablet browsers allow speech later (FR-032). */
    greeting: "Los geht's!",
    updateReady: 'Eine neue Version ist bereit.',
    /** Shown on the start screen when saving stars, progress or bests failed during play (review M6). */
    saveFailed: 'Speichern klappt gerade nicht. Neue Sterne und Fortschritte gelten nur, bis der Browser geschlossen wird.',
    /** Closes a notice on the start screen. */
    dismiss: 'OK',
  },

  /** Match overlay (contracts/screens.md "Match"). */
  match: {
    entryLabel: 'Deine Zahl',
    shoot: 'Schießen',
    help: 'Hilfe',
    pause: 'Pause',
    paused: 'Pause. Weiter mit Enter.',
    resume: 'Weiter',
    fullscreen: 'Vollbild',
    gear: 'Für Eltern',
    lockerRoom: 'Kabine',
    goals: goalCount,
    goalsOf: (n: number, total: number) => `${n} von ${total} Toren`,
    hearts: (n: number) => `${n} Bälle übrig`,
    speaker: 'Vorlesen',
    numberPad: { label: 'Zahlenfeld', delete: 'Löschen', shoot: 'Schießen' },
    /** The task read aloud for each new target with "Vorlesen" on (FR-032); it never says the number. */
    task: { holes: 'Welche Zahl fehlt?', lines: 'Welche Zahl kommt hier?', keeper: 'Welche Zahl fehlt?' },
  },

  /** Feedback lines (contracts/screens.md "Feedback contract"). */
  feedback: {
    goal: 'TOR!',
    correctSquare: 'Richtig!',
    lineDone: 'Reihe fertig!',
    miss: (n: number) => `Hier ist ${n}. Nochmal!`,
    outOfRange: (min: number, max: number) => `Zahlen von ${min} bis ${max}`,
    heartLost: "Weiter geht's!",
  },

  /** Help steps (spec US2): step 1 a hint, step 2 the full chart, step 3 the answer. */
  help: {
    direction: {
      right: 'eins nach rechts: +1',
      left: 'eins nach links: −1',
      down: 'eine Reihe runter: +10',
      up: 'eine Reihe hoch: −10',
      downRight: 'schräg runter nach rechts: +11',
      upLeft: 'schräg hoch nach links: −11',
      downLeft: 'schräg runter nach links: +9',
      upRight: 'schräg hoch nach rechts: −9',
    },
    /** Help step 1 from a neighbor of the target: "Von 36 eine Reihe runter: +10". */
    fromNeighbor: (from: number, step: string) => `Von ${from} ${step}`,
    /** Help step 1 from a hint further away: "Von 26: +20". */
    fromHint: (from: number, offset: number) => `Von ${from}: ${offset < 0 ? '−' : '+'}${Math.abs(offset)}`,
    chartTitle: 'Die Zahlentafel',
    chartTarget: 'Hier ist das Ziel',
    chartLast: 'Hier war dein Ball',
    chartClose: 'Weiter',
    answer: (n: number) => `Das ist ${n}. Schieß!`,
  },

  /** Round end (contracts/screens.md "Round end"). */
  roundEnd: {
    cheer: 'Super gespielt!',
    summary: (goals: number, timeMs: number) => `${goalCount(goals)} in ${clock(timeMs)}`,
    goalsOnly: goalCount,
    newRecord: 'Neuer Rekord!',
    record: (n: number) => `Dein Rekord: ${n}`,
    recordTime: (goals: number, timeMs: number) => `Dein Rekord: ${goalCount(goals)} in ${clock(timeMs)}`,
    stars: (n: number) => `+${starCount(n)}`,
    again: 'Nochmal',
    back: 'Zurück',
  },

  /** Locker room (contracts/screens.md "Locker room"). */
  lockerRoom: {
    title: 'Kabine',
    back: 'Zurück',
    preview: 'Dein Spieler',
    groups: { ball: 'Ball', shirt: 'Trikot', numberName: 'Nummer und Name', fans: 'Fans' },
    shirtNumber: 'Nummer',
    shirtName: 'Name',
    stillNeeded: (n: number) => `noch ${starCount(n)}`,
    price: (n: number) => `★ ${n}`,
    buyQuestion: (n: number) => `Für ${starCount(n)} kaufen?`,
    yes: 'Ja',
    no: 'Nein',
    chosen: 'Gewählt',
    shirtNumberHint: '1 bis 99',
    shirtNameHint: 'Bis zu 10 Buchstaben',
    /** Item names by id (src/core/rewards/items.ts). */
    items: {
      'ball.classic': 'Klassisch',
      'ball.blue': 'Blau',
      'ball.stars': 'Sterne',
      'ball.gold': 'Gold',
      'ball.flames': 'Flammen',
      'ball.rainbow': 'Regenbogen',
      'shirt.yellow': 'Gelb',
      'shirt.white': 'Weiß',
      'shirt.red': 'Rot',
      'shirt.blue': 'Blau',
      'shirt.green': 'Grün',
      'shirt.pink': 'Rosa',
      'shirt.black': 'Schwarz',
      'shirt.orange': 'Orange',
      'scarf.yellow': 'Gelb',
      'scarf.red': 'Rot',
      'scarf.blue': 'Blau',
      'scarf.green': 'Grün',
      'scarf.white': 'Weiß',
      'scarf.purple': 'Lila',
    } as Record<string, string>,
  },

  /** Shown on the start screen when stored data was reset on load (FR-036). */
  storage: {
    reset: {
      invalid:
        'Gespeicherte Daten waren beschädigt und wurden zurückgesetzt. Eine Kopie ist aufbewahrt: Eltern holen sie in den Einstellungen mit „Kopie wiederherstellen“ zurück.',
      newer: 'Gespeicherte Daten stammen von einer neueren Version. Sie bleiben als Kopie im Browser und werden hier nicht verwendet.',
      unavailable: 'Der Browser kann gerade nichts speichern.',
    },
    /** Names the kinds of data a reset note is about. */
    kinds: (names: string) => `Betrifft: ${names}.`,
  },

  /** Parent gate menu (contracts/screens.md "Parent gate"). */
  parent: {
    title: 'Für Eltern',
    settings: 'Einstellungen',
    progress: 'Fortschritt',
    back: 'Zurück',
    close: 'Schließen',
    /** Amendment 01 (FR-050): a kept copy of data that an earlier version could not read, and this version can. */
    backupFound: (names: string) =>
      `Im Browser liegt eine Kopie älterer Daten (${names}). Wiederherstellen ersetzt die aktuellen Daten durch diese Kopie.`,
    restoreBackup: 'Kopie wiederherstellen',
    restoreFailed: 'Die Kopie konnte nicht gespeichert werden. Es wurde nichts geändert.',
    /** A save of several kinds failed, and the old data could not be put back (review H6). */
    savePartial: 'Ein Teil wurde gespeichert, der Rest nicht. Bitte die Daten prüfen oder eine Sicherung laden.',
    /** The four kinds of stored data, for the notice on the settings page. */
    dataNames: { settings: 'Einstellungen', progress: 'Fortschritt', records: 'Rekorde', lockerRoom: 'Sterne und Kabine' },
    holdHint: 'Zahnrad 2 Sekunden gedrückt halten',
  },

  /** Settings page (contracts/screens.md "Settings"; data-model "Settings"). */
  settings: {
    title: 'Einstellungen',
    save: 'Speichern',
    saved: 'Gespeichert. Die Einstellungen gelten ab der nächsten Runde.',
    saveFailed: 'Speichern hat nicht geklappt. Die Einstellungen gelten nur, bis der Browser geschlossen wird.',
    checkFields: 'Bitte die markierten Felder prüfen.',
    persistDenied: 'Der Browser darf gespeicherte Daten löschen. Bitte die Daten ab und zu sichern.',
    version: (version: string, date: string) => `Version ${version} vom ${date}`,
    groups: {
      range: 'Zahlenraum',
      modes: 'Spielarten',
      hints: 'Hinweise',
      lines: 'Reihen',
      round: 'Runde',
      difficulty: 'Schwierigkeit',
      sound: 'Ton',
      controls: 'Bedienung',
      lockerRoom: 'Kabine',
      data: 'Daten',
    },
    labels: {
      rangePreset: 'Zahlenraum',
      rangeMin: 'Von',
      rangeMax: 'Bis',
      hintDisplay: 'Hinweiszahlen',
      hintDistance: 'Abstand der Hinweise',
      lineDirections: 'Richtungen',
      lineLength: 'Länge einer Reihe',
      roundType: 'Rundenende',
      goalsPerRound: 'Tore pro Runde',
      difficulty: 'Schwierigkeit',
      adaptive: 'Passt sich dem Kind an',
      soundEffects: 'Geräusche',
      soundCrowd: 'Fans',
      soundOhh: '„Ohhh“ nach einem Schuss daneben',
      soundSpeech: 'Vorlesen',
      numberPad: 'Zahlenfeld',
      showClock: 'Uhr zeigen',
      showRecords: 'Rekorde zeigen',
      lockerRoom: 'Kabine und Sterne',
      pointAfterFullHelp: 'Punkt nach voller Hilfe',
    },
    options: {
      rangePreset: { '1-100': '1 bis 100', '0-1000': '0 bis 1000', custom: 'Eigener Zahlenraum' },
      modes: { holes: 'Löcher', lines: 'Reihen', keeper: 'Torwart' },
      hintDisplay: { always: 'immer', onRequest: 'auf Wunsch' },
      hintDistance: { direct: 'direkt daneben', vertical: 'darüber und darunter', diagonal: 'schräg', far: 'weiter weg' },
      lineDirections: {
        right: 'nach rechts',
        left: 'nach links',
        down: 'nach unten',
        up: 'nach oben',
        downRight: 'schräg nach rechts unten',
        upLeft: 'schräg nach links oben',
        downLeft: 'schräg nach links unten',
        upRight: 'schräg nach rechts oben',
      },
      roundType: { untilHearts: 'Bis die Bälle weg sind', goalCount: 'Feste Zahl an Toren' },
      difficulty: { easy: 'leicht (5 Schüsse pro Ball)', normal: 'normal (4 Schüsse pro Ball)', challenging: 'schwer (3 Schüsse pro Ball)' },
      numberPad: { auto: 'automatisch', always: 'immer', never: 'nie' },
    },
    data: {
      export: 'Daten sichern',
      import: 'Daten laden',
      qr: 'QR-Code',
      exportHint: 'Speichert Einstellungen, Fortschritt, Rekorde und Sterne in einer Datei.',
      imported: 'Daten geladen. Die Einstellungen gelten ab der nächsten Runde.',
      importFailed: {
        notJson: 'Diese Datei ist keine Sicherung von Mathe-Kicker.',
        wrongApp: 'Diese Datei ist keine Sicherung von Mathe-Kicker.',
        invalidSettings: 'Die Einstellungen in dieser Datei sind ungültig. Es wurde nichts geändert.',
        invalidProgress: 'Der Fortschritt in dieser Datei ist ungültig. Es wurde nichts geändert.',
        invalidRecords: 'Die Rekorde in dieser Datei sind ungültig. Es wurde nichts geändert.',
        invalidLockerRoom: 'Die Sterne in dieser Datei sind ungültig. Es wurde nichts geändert.',
        storeFailed: 'Der Browser konnte die Daten nicht speichern. Es wurde nichts geändert.',
        storePartial: 'Ein Teil wurde gespeichert, der Rest nicht. Bitte die Daten prüfen oder eine Sicherung laden.',
      },
      readFailed: 'Die Datei konnte nicht gelesen werden.',
      exportFailed: 'Die Sicherung konnte nicht heruntergeladen werden.',
    },
  },

  /** Messages for settings that break a rule (keys from SETTINGS_ERROR_KEYS in core/settings/validate.ts). */
  settingsErrors: {
    rangeNotInteger: 'Bitte ganze Zahlen eingeben.',
    rangeOutside: 'Der Zahlenraum liegt zwischen 0 und 1000.',
    rangeOrder: '„Von“ muss kleiner sein als „Bis“.',
    rangeSpan: 'Der Zahlenraum braucht mindestens 10 Zahlen.',
    rangePresetMismatch: 'Von und Bis passen nicht zum gewählten Zahlenraum.',
    noMode: 'Mindestens eine Spielart muss an sein.',
    noHintDistance: 'Mindestens ein Abstand muss an sein.',
    noLineDirection: 'Mindestens eine Richtung muss an sein.',
    lineLength: 'Eine Reihe hat 3 bis 10 Felder.',
    goalsPerRound: 'Eine Runde hat 1 bis 20 Tore.',
  },

  /** Progress page (contracts/screens.md "Progress"). */
  progressPage: {
    title: 'Fortschritt',
    columns: {
      direction: 'Richtung',
      mode: 'Spielart',
      attempts: 'Versuche',
      alone: 'allein',
      withHelp: 'mit Hilfe',
      step: 'Stufe',
      mastered: 'gemeistert',
    },
    directions: {
      right: 'rechts (+1)',
      left: 'links (−1)',
      down: 'runter (+10)',
      up: 'hoch (−10)',
      downRight: 'schräg rechts runter (+11)',
      upLeft: 'schräg links hoch (−11)',
      downLeft: 'schräg links runter (+9)',
      upRight: 'schräg rechts hoch (−9)',
    },
    modes: { holes: 'Löcher', lines: 'Reihen', keeper: 'Torwart' },
    bests: 'Rekorde',
    bestLine: (goals: number, timeMs: number) => `${goalCount(goals)} in ${clock(timeMs)}`,
    empty: 'Noch keine Versuche.',
    reset: 'Fortschritt zurücksetzen',
    resetConfirm: 'Fortschritt wirklich zurücksetzen? Die Sterne bleiben.',
    resetYes: 'Ja, zurücksetzen',
    resetNo: 'Abbrechen',
    resetDone: 'Fortschritt zurückgesetzt. Die Sterne sind geblieben.',
    resetFailed: 'Zurücksetzen hat nicht geklappt.',
    /** Amendment 01 (FR-051): clears progress, personal bests, stars and the locker room; the settings stay. */
    resetAll: 'Alles zurücksetzen',
    resetAllConfirm:
      'Fortschritt, Rekorde, Sterne und Kabine löschen? Die Einstellungen bleiben. Wer den Spielstand behalten will, sichert ihn vorher in den Einstellungen.',
    resetAllYes: 'Ja, alles löschen',
    resetAllDone: 'Alles wurde zurückgesetzt.',
    resetAllFailed: 'Zurücksetzen hat nicht geklappt. Es wurde nichts geändert.',
    resetAllPartial: 'Ein Teil wurde gespeichert, der Rest nicht. Bitte die Daten prüfen oder eine Sicherung laden.',
    close: 'Schließen',
    stepOf: (step: number, count: number) => `${step} von ${count}`,
    toRaise: (n: number) => (n === 1 ? 'noch 1 Treffer allein bis zur nächsten Stufe' : `noch ${n} Treffer allein bis zur nächsten Stufe`),
    masteredYes: 'ja',
    masteredNo: 'noch nicht',
    noBests: 'Noch keine Rekorde.',
    roundTypes: { untilHearts: 'bis die Bälle weg sind', goalCount: 'feste Zahl an Toren' },
    range: (min: number, max: number) => `${min} bis ${max}`,
  },

  /** Transfer dialog, as math-tank (contracts/screens.md "Transfer dialog"). */
  transfer: {
    title: 'Spielstand übertragen',
    hint: 'Mit der Kamera des anderen Geräts scannen oder den Link dort öffnen.',
    qrLabel: 'QR-Code mit dem Spielstand',
    copy: 'Link kopieren',
    copied: 'Link kopiert.',
    copyFailed: 'Kopieren hat nicht geklappt. Bitte diesen Link kopieren:',
    tooLarge: 'Der Spielstand ist zu groß für einen QR-Code. Bitte den Link kopieren.',
    trimmed: 'Der Spielstand wurde für den QR-Code gekürzt: die letzten Versuche je Richtung fehlen.',
    buildFailed: 'Der Link konnte nicht erstellt werden.',
    summary: (stars: number, record: number, min: number, max: number) =>
      `${starCount(stars)}, Rekord ${goalCount(record)}, Zahlenraum ${min} bis ${max}`,
    holdHint: '„Übernehmen“ 2 Sekunden gedrückt halten.',
    saveFailed: 'Speichern hat nicht geklappt. Es wurde nichts geändert.',
    savePartial: 'Ein Teil wurde gespeichert, der Rest nicht. Bitte die Daten prüfen oder eine Sicherung laden.',
    receiveTitle: 'Spielstand übernehmen?',
    receiveHint: 'Der Spielstand aus dem Link ersetzt den Spielstand in diesem Browser.',
    accept: 'Übernehmen',
    decline: 'Abbrechen',
    accepted: 'Spielstand übernommen.',
    invalid: 'Dieser Link enthält keinen gültigen Spielstand.',
    close: 'Schließen',
  },
};
