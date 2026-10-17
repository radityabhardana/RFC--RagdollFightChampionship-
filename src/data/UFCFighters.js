/**
 * Official Real-Life UFC Fighter Database
 * Features popular champions and contenders across 4 key weight divisions.
 * Contains visual customization (hair, beard, tattoos, skin tone, trunks) and combat stats.
 */

export const UFC_DIVISIONS = [
  {
    id: 'FEATHERWEIGHT',
    name: 'FEATHERWEIGHT',
    weightLimit: '145 LBS (65.8 KG)',
    beltHolder: 'Ilia Topuria',
    description: 'Fast hands, devastating angles, and relentless volume.',
  },
  {
    id: 'LIGHTWEIGHT',
    name: 'LIGHTWEIGHT',
    weightLimit: '155 LBS (70.3 KG)',
    beltHolder: 'Islam Makhachev',
    description: 'The most stacked division in UFC history. Precision striking & lethal grappling.',
  },
  {
    id: 'MIDDLEWEIGHT',
    name: 'MIDDLEWEIGHT',
    weightLimit: '185 LBS (83.9 KG)',
    beltHolder: 'Dricus Du Plessis',
    description: 'Gladiator power, kickboxing royalty, and granite chins.',
  },
  {
    id: 'LIGHT_HEAVYWEIGHT',
    name: 'LIGHT HEAVYWEIGHT',
    weightLimit: '205 LBS (93.0 KG)',
    beltHolder: 'Alex Pereira',
    description: 'Maximum knockout torque, long frame leverage, and legendary champions.',
  },
];

export const UFC_FIGHTERS = [
  // --- 1. FEATHERWEIGHT (145 LBS) ---
  {
    id: 'ilia_topuria',
    name: 'ILIA TOPURIA',
    nickname: 'EL MATADOR',
    division: 'FEATHERWEIGHT',
    country: '🇪🇸 SPAIN / 🇬🇪 GEORGIA',
    record: '15-0-0',
    rank: 'CHAMPION',
    height: "5'7\" (170 cm)",
    reach: '69" (175 cm)',
    stance: 'ORTHODOX',
    skinColor: 0xd9a482,
    hairStyle: 'SLICK_FADE',
    hairColor: 0x1a1411,
    beardStyle: 'TRIMMED_BOX',
    beardColor: 0x16100d,
    tattooType: 'TOPURIA_CROWN_CROSS',
    trunksColor: 0xa81118, // Spanish Red
    trunksTrimColor: 0xd4af37, // Gold Champion Trim
    stats: {
      power: 96,
      speed: 93,
      stamina: 89,
      chin: 92,
      reach: 84,
    },
    bio: 'Fierce knockout puncher with elite European boxing mechanics and surgical precision.',
  },
  {
    id: 'max_holloway',
    name: 'MAX HOLLOWAY',
    nickname: 'BLESSED',
    division: 'FEATHERWEIGHT',
    country: '🇺🇸 HAWAII, USA',
    record: '26-7-0',
    rank: '#1 CONTENDER / BMF',
    height: "5'11\" (180 cm)",
    reach: '69" (175 cm)',
    stance: 'ORTHODOX',
    skinColor: 0xb5825d,
    hairStyle: 'LOW_BUZZ',
    hairColor: 0x141416,
    beardStyle: 'MUSTACHE_STUBBLE',
    beardColor: 0x141416,
    tattooType: 'HOLLOWAY_WINGS_POLYNESIAN',
    trunksColor: 0x18181b, // Hawaiian Black
    trunksTrimColor: 0xf97316, // Island Orange Trim
    stats: {
      power: 87,
      speed: 95,
      stamina: 99,
      chin: 98,
      reach: 85,
    },
    bio: 'The undisputed king of volume and legendary BMF champion with unlimited cardio.',
  },
  {
    id: 'alex_volkanovski',
    name: 'ALEXANDER VOLKANOVSKI',
    nickname: 'THE GREAT',
    division: 'FEATHERWEIGHT',
    country: '🇦🇺 AUSTRALIA',
    record: '26-4-0',
    rank: '#2 CONTENDER',
    height: "5'6\" (168 cm)",
    reach: '71" (180 cm)',
    stance: 'ORTHODOX',
    skinColor: 0xdeb393,
    hairStyle: 'SHAVED',
    hairColor: 0x221a15,
    beardStyle: 'RUGGED_TRIMMED',
    beardColor: 0x201813,
    tattooType: 'TRIBAL_SHOULDER',
    trunksColor: 0x054f2c, // Aussie Green
    trunksTrimColor: 0xf59e0b, // Aussie Gold
    stats: {
      power: 89,
      speed: 94,
      stamina: 96,
      chin: 91,
      reach: 88,
    },
    bio: 'Rugby powerhouse turned pound-for-pound maestro with feints, low kicks and fight IQ.',
  },

  // --- 2. LIGHTWEIGHT (155 LBS) ---
  {
    id: 'islam_makhachev',
    name: 'ISLAM MAKHACHEV',
    nickname: 'THE EAGLE HEIR',
    division: 'LIGHTWEIGHT',
    country: '🇷🇺 DAGESTAN, RUSSIA',
    record: '26-1-0',
    rank: 'CHAMPION',
    height: "5'10\" (178 cm)",
    reach: '70" (178 cm)',
    stance: 'SOUTHPAW',
    skinColor: 0xcd9a7c,
    hairStyle: 'CROPPED_BUZZ',
    hairColor: 0x1c140e,
    beardStyle: 'DAGESTANI_CHINSTRAP',
    beardColor: 0x18100a,
    tattooType: 'NONE',
    trunksColor: 0x131518, // Black Champion Trunks
    trunksTrimColor: 0xd4af37, // Gold Octagon Trim
    stats: {
      power: 92,
      speed: 91,
      stamina: 95,
      chin: 94,
      reach: 87,
    },
    bio: 'Pound-for-pound #1 fighter with devastating southpaw headkicks and airtight defense.',
  },
  {
    id: 'conor_mcgregor',
    name: 'CONOR MCGREGOR',
    nickname: 'THE NOTORIOUS',
    division: 'LIGHTWEIGHT',
    country: '🇮🇪 IRELAND',
    record: '22-6-0',
    rank: 'DOUBLE CHAMP LEGEND',
    height: "5'9\" (175 cm)",
    reach: '74" (188 cm)',
    stance: 'SOUTHPAW',
    skinColor: 0xe8be9d, // Irish fair skin
    hairStyle: 'SLICK_UNDERCUT',
    hairColor: 0x7a4321, // Auburn Ginger
    beardStyle: 'FULL_GINGER_BEARD',
    beardColor: 0x703c1d,
    tattooType: 'MCGREGOR_GORILLA_TIGER',
    trunksColor: 0x00843d, // Irish Emerald Green
    trunksTrimColor: 0xff883e, // Irish Gold/Orange Trim
    stats: {
      power: 98,
      speed: 96,
      stamina: 84,
      chin: 88,
      reach: 92,
    },
    bio: 'Historic double champ with the most iconic left hand and sniper timing in combat sports.',
  },
  {
    id: 'khabib_nurmagomedov',
    name: 'KHABIB NURMAGOMEDOV',
    nickname: 'THE EAGLE',
    division: 'LIGHTWEIGHT',
    country: '🇷🇺 DAGESTAN, RUSSIA',
    record: '29-0-0',
    rank: 'HALL OF FAME (UNDFEATED)',
    height: "5'10\" (178 cm)",
    reach: '70" (178 cm)',
    stance: 'ORTHODOX',
    skinColor: 0xd09f82,
    hairStyle: 'TRADITIONAL_BUZZ',
    hairColor: 0x1b130e,
    beardStyle: 'DAGESTANI_CHINSTRAP',
    beardColor: 0x18100b,
    tattooType: 'NONE',
    trunksColor: 0xa4131b, // Russian Red
    trunksTrimColor: 0x151618, // Black Trim
    stats: {
      power: 90,
      speed: 90,
      stamina: 99,
      chin: 99,
      reach: 86,
    },
    bio: 'Undefeated 29-0 Hall of Famer who never bled, never lost a round, and mauled contenders.',
  },
  {
    id: 'dustin_poirier',
    name: 'DUSTIN POIRIER',
    nickname: 'THE DIAMOND',
    division: 'LIGHTWEIGHT',
    country: '🇺🇸 LOUISIANA, USA',
    record: '30-8-0',
    rank: '#3 CONTENDER',
    height: "5'9\" (175 cm)",
    reach: '72" (183 cm)',
    stance: 'SOUTHPAW',
    skinColor: 0xd8a381,
    hairStyle: 'SALON_FADE',
    hairColor: 0x241812,
    beardStyle: 'TRIMMED_STUBBLE',
    beardColor: 0x1f140f,
    tattooType: 'POIRIER_JAPANESE_SLEEVES',
    trunksColor: 0x1a1b1f, // Louisiana Floral Black
    trunksTrimColor: 0x10b981, // Teal Floral Accent
    stats: {
      power: 94,
      speed: 92,
      stamina: 93,
      chin: 93,
      reach: 89,
    },
    bio: 'Gritty Louisiana warrior with savage shifting hooks, calf kicks, and diamond durability.',
  },
  {
    id: 'charles_oliveira',
    name: 'CHARLES OLIVEIRA',
    nickname: 'DO BRONX',
    division: 'LIGHTWEIGHT',
    country: '🇧🇷 BRAZIL',
    record: '34-10-0',
    rank: '#2 CONTENDER',
    height: "5'10\" (178 cm)",
    reach: '74" (188 cm)',
    stance: 'ORTHODOX',
    skinColor: 0xbe8c68,
    hairStyle: 'BLEACHED_BLONDE',
    hairColor: 0xded19b, // Bleached Blonde
    beardStyle: 'CLEAN_STUBBLE',
    beardColor: 0x36281e,
    tattooType: 'OLIVEIRA_LIONS',
    trunksColor: 0x0f1013, // Favela Black
    trunksTrimColor: 0xeab308, // Brazilian Yellow
    stats: {
      power: 93,
      speed: 93,
      stamina: 90,
      chin: 86,
      reach: 91,
    },
    bio: 'The UFC all-time finish leader who rises from adversity to deliver thrilling finishes.',
  },

  // --- 3. MIDDLEWEIGHT (185 LBS) ---
  {
    id: 'alex_pereira',
    name: 'ALEX PEREIRA',
    nickname: 'POATAN (HANDS OF STONE)',
    division: 'MIDDLEWEIGHT',
    country: '🇧🇷 BRAZIL',
    record: '12-2-0',
    rank: '2-DIVISION CHAMPION',
    height: "6'4\" (193 cm)",
    reach: '79" (201 cm)',
    stance: 'ORTHODOX',
    skinColor: 0x9e6a47, // Brazilian indigenous bronze
    hairStyle: 'STONE_CREWCUT',
    hairColor: 0x101012,
    beardStyle: 'CLEAN_SHAVEN',
    beardColor: 0x101012,
    tattooType: 'POATAN_INDIGENOUS_TRIBAL',
    trunksColor: 0x111316, // Black & Gold
    trunksTrimColor: 0xd4af37, // Gold Champion Trim
    stats: {
      power: 100, // Maximum single strike KO power
      speed: 89,
      stamina: 88,
      chin: 94,
      reach: 97,
    },
    bio: 'Stone-faced kickboxing legend with the most terrifying left hook and calf kicks on Earth.',
  },
  {
    id: 'israel_adesanya',
    name: 'ISRAEL ADESANYA',
    nickname: 'THE LAST STYLEBENDER',
    division: 'MIDDLEWEIGHT',
    country: '🇳🇬 NIGERIA / 🇳🇿 NZ',
    record: '24-4-0',
    rank: '#1 CONTENDER',
    height: "6'4\" (193 cm)",
    reach: '80" (203 cm)',
    stance: 'ORTHODOX', // Switches fluidly
    skinColor: 0x583928, // Deep Nigerian tone
    hairStyle: 'TEXTURED_FADE',
    hairColor: 0x101012,
    beardStyle: 'LEAN_GOATEE',
    beardColor: 0x101012,
    tattooType: 'ADESANYA_BROKEN_NATIVE',
    trunksColor: 0x1b2838, // Anime Deep Blue
    trunksTrimColor: 0x00d293, // Cyan Trim
    stats: {
      power: 91,
      speed: 98,
      stamina: 94,
      chin: 90,
      reach: 99,
    },
    bio: 'Master counter-striker with Matrix-like head slips, question mark kicks, and anime flair.',
  },
  {
    id: 'dricus_du_plessis',
    name: 'DRICUS DU PLESSIS',
    nickname: 'STILLKNOCKS',
    division: 'MIDDLEWEIGHT',
    country: '🇿🇦 SOUTH AFRICA',
    record: '21-2-0',
    rank: 'CHAMPION',
    height: "6'1\" (185 cm)",
    reach: '76" (193 cm)',
    stance: 'ORTHODOX',
    skinColor: 0xdcb091,
    hairStyle: 'TEXTURED_CROP',
    hairColor: 0x8a6e4d,
    beardStyle: 'TRIMMED_STUBBLE',
    beardColor: 0x523d2a,
    tattooType: 'CROSS_SHOULDER',
    trunksColor: 0x007849, // South African Green
    trunksTrimColor: 0xffb81c, // Gold Trim
    stats: {
      power: 95,
      speed: 88,
      stamina: 97,
      chin: 97,
      reach: 93,
    },
    bio: 'Relentless South African bull with unorthodox explosive lunging overhands and iron grit.',
  },

  // --- 4. LIGHT HEAVYWEIGHT (205 LBS) ---
  {
    id: 'jon_jones',
    name: 'JON JONES',
    nickname: 'BONES',
    division: 'LIGHT_HEAVYWEIGHT',
    country: '🇺🇸 NEW YORK, USA',
    record: '27-1-0',
    rank: 'HEAVYWEIGHT CHAMPION / GOAT',
    height: "6'4\" (193 cm)",
    reach: '84.5" (215 cm)', // Longest reach in UFC
    stance: 'ORTHODOX',
    skinColor: 0x5a3c2a, // Deep brown
    hairStyle: 'CLEAN_BUZZ',
    hairColor: 0x121214,
    beardStyle: 'TRIMMED_GOATEE',
    beardColor: 0x121214,
    tattooType: 'JONES_PHILIPPIANS_413',
    trunksColor: 0x0f1012, // Gold Champion Trunks
    trunksTrimColor: 0xd4af37, // Gold Trim
    stats: {
      power: 94,
      speed: 91,
      stamina: 96,
      chin: 98,
      reach: 100, // Highest reach stat
    },
    bio: 'Widely considered the greatest martial artist in MMA history with unmatched range control.',
  },
  {
    id: 'jiri_prochazka',
    name: 'JIRI PROCHAZKA',
    nickname: 'BJP (BUSHIDO)',
    division: 'LIGHT_HEAVYWEIGHT',
    country: '🇨🇿 CZECH REPUBLIC',
    record: '30-5-1',
    rank: '#1 CONTENDER',
    height: "6'3\" (191 cm)",
    reach: '80" (203 cm)',
    stance: 'ORTHODOX',
    skinColor: 0xdcae8d,
    hairStyle: 'SAMURAI_TOPKNOT',
    hairColor: 0x221a15,
    beardStyle: 'SAMURAI_TUFT',
    beardColor: 0x1c140e,
    tattooType: 'BUSHIDO_SCRIPT',
    trunksColor: 0x111625, // Czech Navy
    trunksTrimColor: 0xcc1422, // Czech Red
    stats: {
      power: 97,
      speed: 91,
      stamina: 92,
      chin: 95,
      reach: 96,
    },
    bio: 'Modern samurai warrior fighting with relentless forward chaos, flying knees, and warrior spirit.',
  },
];
