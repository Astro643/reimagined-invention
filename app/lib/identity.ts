import { createHash, randomInt } from "node:crypto"

// Accounts have no email: the username doubles as the local part of a
// synthetic, never-sent address that Better Auth requires internally.
// "gurup" -> "gurup@users.local". The UNIQUE constraint on user.email is
// what enforces username uniqueness.

export const USERNAME_RE = /^[a-z0-9][a-z0-9_.-]{2,29}$/

export function normalizeUsername(raw: string) {
  return raw.trim().toLowerCase()
}

export function validUsername(raw: string) {
  return USERNAME_RE.test(normalizeUsername(raw))
}

export function usernameToEmail(username: string) {
  return `${normalizeUsername(username)}@users.local`
}

// 26-word recovery phrase. Words are chosen uniformly at random; the phrase
// is shown exactly once at signup and only its SHA-256 hash is stored.
const WORDS = [
  "able", "acid", "aged", "also", "area", "army", "away", "baby", "back", "ball",
  "band", "bank", "base", "bath", "bear", "beat", "been", "beer", "bell", "belt",
  "bend", "best", "bill", "bird", "blue", "boat", "body", "bomb", "bond", "bone",
  "book", "born", "boss", "both", "bowl", "bulk", "burn", "busy", "cafe", "cage",
  "cake", "call", "calm", "came", "camp", "card", "care", "case", "cash", "cast",
  "cave", "cell", "chat", "chip", "city", "clap", "claw", "clay", "clip", "club",
  "coal", "coat", "code", "coil", "coin", "cold", "comb", "cook", "cool", "cope",
  "copy", "cord", "core", "corn", "cost", "crab", "crew", "crop", "crowd", "cure",
  "curl", "cute", "damp", "dare", "dark", "data", "date", "dawn", "days", "dead",
  "deaf", "deal", "dean", "dear", "debt", "deck", "deep", "deer", "denim", "desk",
  "dial", "dice", "diet", "dime", "dine", "dire", "dirt", "dish", "disk", "dock",
  "does", "doll", "dome", "done", "door", "dose", "down", "doze", "draw", "drew",
  "drum", "dual", "duck", "dull", "duty", "each", "earl", "earn", "ease", "east",
  "easy", "edge", "edit", "else", "emit", "epic", "even", "ever", "evil", "exam",
  "exit", "face", "fact", "fade", "fail", "fair", "fake", "fall", "fame", "farm",
  "fast", "fate", "fawn", "fear", "feed", "feel", "feet", "fell", "felt", "fern",
  "file", "fill", "film", "find", "fine", "fire", "firm", "fish", "fist", "five",
  "flag", "flat", "flee", "flew", "flip", "flow", "foam", "foil", "fold", "folk",
  "fond", "font", "food", "fool", "foot", "ford", "fork", "form", "fort", "foul",
  "four", "free", "frog", "from", "fuel", "full", "fund", "gain", "gait", "game",
  "gate", "gave", "gaze", "gear", "gems", "gene", "gift", "girl", "give", "glad",
  "glow", "glue", "goal", "goat", "gold", "golf", "gone", "good", "grab", "gram",
  "gray", "grew", "grey", "grid", "grim", "grin", "grip", "grow", "gulf", "guru",
  "guru", "hack", "hair", "half", "hall", "hand", "hang", "hard", "harm", "hash",
  "hate", "have", "hawk", "head", "heal", "heap", "hear", "heat", "held", "hell",
  "help", "herd", "here", "hero", "hide", "high", "hike", "hill", "hint", "hire",
  "hold", "hole", "holy", "home", "hone", "hood", "hook", "hope", "horn", "hose",
  "host", "hour", "huge", "hull", "hung", "hunt", "hurt", "icon", "idea", "idle",
  "inch", "into", "iron", "isle", "item", "jade", "jail", "jazz", "jest", "join",
  "joke", "jolt", "jump", "jury", "just", "keel", "keen", "keep", "kelp", "kept",
  "kick", "kind", "king", "kiss", "kite", "knee", "knew", "knit", "knot", "know",
  "lace", "lack", "laid", "lake", "lamb", "lamp", "land", "lane", "last", "late",
  "lava", "lazy", "lead", "leaf", "leak", "lean", "leap", "left", "lend", "lens",
  "lent", "less", "liar", "lick", "life", "lift", "like", "lily", "limb", "lime",
  "line", "link", "lint", "lion", "list", "live", "load", "loaf", "loan", "lock",
  "lodge", "loft", "logo", "lone", "long", "look", "loom", "loop", "lord", "lose",
  "loss", "lost", "lots", "loud", "love", "luck", "lump", "lung", "lure", "lush",
  "made", "maid", "mail", "main", "make", "male", "mall", "malt", "mane", "many",
  "mare", "mark", "mask", "mass", "mast", "mate", "math", "maze", "mead", "meal",
  "mean", "meat", "meet", "melt", "memo", "menu", "meow", "mere", "mesh", "mess",
  "mice", "mild", "mile", "milk", "mill", "mind", "mine", "mint", "mist", "mite",
  "moat", "mock", "mode", "mold", "mole", "monk", "mood", "moon", "moor", "more",
  "moss", "most", "moth", "move", "much", "muddy", "mule", "murk", "muse", "mush",
  "must", "mute", "myth", "nail", "name", "navy", "near", "neat", "neck", "need",
  "nest", "news", "next", "nice", "nick", "nine", "node", "none", "noon", "norm",
  "nose", "note", "noun", "nova", "numb", "oath", "obey", "odds", "ogle", "ogle",
  "omen", "omit", "once", "only", "onto", "onyx", "ooze", "opal", "open", "oral",
  "ouch", "ours", "oval", "oven", "over", "pace", "pack", "page", "paid", "pail",
  "pain", "pair", "pale", "palm", "pane", "pang", "pant", "pare", "park", "part",
  "pass", "past", "path", "peak", "peal", "pear", "peat", "peck", "peek", "peel",
  "peep", "peer", "pelt", "perk", "perm", "pert", "peso", "pest", "pick", "pier",
  "pile", "pill", "pine", "pink", "pipe", "pith", "plan", "play", "plea", "pleb",
  "plot", "plow", "ploy", "plug", "plum", "plus", "poem", "poet", "poke", "pole",
  "poll", "pond", "pony", "pool", "poor", "pope", "pore", "port", "pose", "posh",
  "post", "pour", "pray", "prey", "prop", "prow", "pull", "pulp", "pump", "pure",
  "push", "putt", "quip", "quit", "quiz", "race", "rack", "raft", "rage", "raid",
  "rail", "rain", "rake", "ramp", "rang", "rank", "rant", "rare", "rash", "rate",
  "rave", "read", "real", "ream", "reap", "rear", "reed", "reef", "reek", "reel",
  "rein", "rely", "rend", "rent", "rest", "rice", "rich", "ride", "rife", "riff",
  "rift", "rigs", "rile", "rill", "rime", "rims", "rind", "ring", "rink", "riot",
  "ripe", "rise", "risk", "rite", "road", "roam", "roar", "robe", "rock", "rode",
  "role", "roll", "roof", "rook", "room", "root", "rope", "rose", "rote", "rout",
  "rove", "ruby", "rude", "ruin", "rule", "rung", "runs", "runt", "ruse", "rush",
  "rust", "ruth", "sack", "safe", "saga", "sage", "said", "sail", "sake", "sale",
  "salt", "same", "sand", "sane", "sang", "sank", "sash", "save", "sawn", "said",
  "scan", "scar", "seal", "seam", "sear", "seas", "seat", "sect", "seed", "seek",
  "seem", "seen", "seep", "sees", "self", "sell", "semi", "send", "sent", "serf",
  "sets", "sewn", "sham", "shed", "shim", "shin", "ship", "shod", "shoe", "shop",
  "shot", "show", "shut", "sick", "side", "sift", "sigh", "sign", "silk", "sill",
  "silt", "sing", "sink", "sins", "site", "size", "skew", "skid", "skim", "skin",
  "skip", "skit", "slab", "slam", "slap", "slat", "slaw", "sled", "slew", "slid",
  "slim", "slit", "slob", "slog", "slop", "slot", "slow", "slue", "slug", "slum",
  "slur", "smog", "snap", "snip", "snob", "snot", "snow", "snub", "snug", "soak",
  "soap", "soar", "sock", "soda", "sofa", "soft", "soil", "sold", "sole", "solo",
  "some", "song", "soon", "sore", "sort", "soul", "soup", "sour", "span", "spar",
  "spat", "sped", "spin", "spit", "spot", "spun", "spur", "stab", "stag", "star",
  "stay", "stem", "step", "stew", "stir", "stop", "stow", "stub", "such", "suds",
  "suit", "sulk", "sum", "sung", "sunk", "sure", "surf", "swan", "swap", "swim",
  "tack", "tact", "tail", "take", "tale", "talk", "tall", "tame", "tank", "tape",
  "tarn", "tarp", "tart", "task", "taut", "taxi", "teak", "teal", "team", "tear",
  "teem", "teen", "tell", "temp", "tend", "tent", "term", "tern", "test", "text",
  "than", "that", "them", "then", "they", "thin", "this", "thud", "thug", "tick",
  "tidal", "tide", "tidy", "tile", "till", "tilt", "time", "tiny", "tire", "toad",
  "toed", "toil", "told", "toll", "tomb", "tome", "tone", "tong", "tons", "took",
  "tool", "tops", "torn", "tort", "toss", "tour", "tout", "town", "trap", "tray",
  "tree", "trek", "trim", "trio", "trip", "trod", "trot", "true", "tsar", "tuba",
  "tube", "tuck", "tuft", "tuna", "tune", "turn", "tusk", "twig", "twin", "twit",
  "tyke", "ugly", "undo", "unit", "upon", "urge", "used", "user", "vain", "vale",
  "vane", "vase", "vast", "veal", "veer", "veil", "vein", "vent", "verb", "very",
  "vest", "veto", "vial", "vice", "view", "vine", "visa", "void", "volt", "vote",
  "wade", "wage", "wait", "wake", "walk", "wall", "wand", "want", "ward", "warm",
  "warn", "warp", "wart", "wasp", "wave", "waxy", "ways", "weak", "wean", "wear",
  "weed", "week", "weep", "well", "went", "wept", "were", "west", "what", "when",
  "whim", "whip", "whir", "whiz", "whoa", "whom", "wide", "wife", "wild", "will",
  "wilt", "wily", "wimp", "wind", "wine", "wing", "wink", "wipe", "wire", "wise",
  "wish", "with", "woke", "wolf", "womb", "wood", "woof", "wool", "word", "wore",
  "work", "worm", "worn", "wove", "wrap", "wren", "writ", "yard", "yarn", "yawn",
  "yeah", "year", "yell", "yelp", "yoga", "yoke", "yolk", "your", "zeal", "zero",
  "zest", "zinc", "zone", "zoom",
]

export function generateRecoveryPhrase() {
  const words: string[] = []
  for (let i = 0; i < 26; i++) words.push(WORDS[randomInt(WORDS.length)])
  return words.join(" ")
}

export function hashRecoveryPhrase(phrase: string) {
  const normalized = phrase.trim().toLowerCase().replace(/\s+/g, " ")
  return createHash("sha256").update(normalized).digest("hex")
}
