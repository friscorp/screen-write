export interface VocabLeaf {
  word: string
  emoji: string
  sentence: string
}

export interface VocabBranch {
  word: string
  emoji: string
  children: VocabLeaf[]
}

export interface VocabCategory {
  id: string
  word: string
  emoji: string
  description?: string
  children: VocabBranch[]
}

export const VOCAB_TREE_KEY = "aac-vocab-tree"

export const DEFAULT_VOCAB_TREE: VocabCategory[] = [
  {
    id: "food",
    word: "Food",
    emoji: "🍕",
    children: [
      {
        word: "Drink",
        emoji: "🥤",
        children: [
          { word: "Water", emoji: "💧", sentence: "I'm really thirsty, can I please have some water?" },
          { word: "Milk", emoji: "🥛", sentence: "Can I have a cold glass of milk please?" },
          { word: "Juice", emoji: "🧃", sentence: "I'd love some juice, can I have some please?" },
          { word: "Lemonade", emoji: "🍋", sentence: "Can I have some yummy lemonade please?" },
          { word: "Hot chocolate", emoji: "☕", sentence: "Can I have some warm hot chocolate please?" },
        ],
      },
      {
        word: "Meal",
        emoji: "🍽️",
        children: [
          { word: "Pizza", emoji: "🍕", sentence: "I'm hungry, can we please have pizza for dinner?" },
          { word: "Sandwich", emoji: "🥪", sentence: "Can I have a yummy sandwich please? I'm hungry!" },
          { word: "Pasta", emoji: "🍝", sentence: "I'd really love some pasta, can we have that?" },
          { word: "Rice", emoji: "🍚", sentence: "Can I have some rice with dinner please?" },
          { word: "Soup", emoji: "🍲", sentence: "I'd love a warm bowl of soup, it sounds so good!" },
        ],
      },
      {
        word: "Snack",
        emoji: "🍪",
        children: [
          { word: "Cookies", emoji: "🍪", sentence: "I'm a bit hungry, can I please have some cookies?" },
          { word: "Chips", emoji: "🍟", sentence: "Can I have some chips for a snack please?" },
          { word: "Apple", emoji: "🍎", sentence: "I'd like an apple as a healthy snack please!" },
          { word: "Crackers", emoji: "🥨", sentence: "Can I have some crackers? I'm a little hungry!" },
          { word: "Yogurt", emoji: "🫙", sentence: "I would love some yummy yogurt as a snack please!" },
        ],
      },
      {
        word: "Sweet",
        emoji: "🍭",
        children: [
          { word: "Ice cream", emoji: "🍦", sentence: "Can we have ice cream? It sounds so yummy and cold!" },
          { word: "Cake", emoji: "🎂", sentence: "I'd love a piece of cake, can I have some please?" },
          { word: "Candy", emoji: "🍬", sentence: "Can I have just a little bit of candy please?" },
          { word: "Chocolate", emoji: "🍫", sentence: "I really want some chocolate, can I have a piece?" },
          { word: "Muffin", emoji: "🧁", sentence: "Can I have a muffin please? They're so delicious!" },
        ],
      },
      {
        word: "Fruit",
        emoji: "🍎",
        children: [
          { word: "Strawberries", emoji: "🍓", sentence: "Can I have some strawberries please? I love them so much!" },
          { word: "Grapes", emoji: "🍇", sentence: "I'd love some grapes, can I have a bunch please?" },
          { word: "Banana", emoji: "🍌", sentence: "Can I have a banana please? I'm a bit hungry!" },
          { word: "Orange", emoji: "🍊", sentence: "I'd like an orange, can I have one please?" },
          { word: "Watermelon", emoji: "🍉", sentence: "Can I have some watermelon? It's so refreshing!" },
        ],
      },
    ],
  },
  {
    id: "play",
    word: "Play",
    emoji: "🎮",
    children: [
      {
        word: "Outside",
        emoji: "🌳",
        children: [
          { word: "Park", emoji: "🏞️", sentence: "Can we go to the park? I really want to play outside!" },
          { word: "Swings", emoji: "🛝", sentence: "I want to go on the swings, can we please go now?" },
          { word: "Bike", emoji: "🚲", sentence: "Can I ride my bike outside please? That sounds so fun!" },
          { word: "Run", emoji: "🏃", sentence: "I want to run around outside, can we please go play?" },
          { word: "Sandbox", emoji: "🏖️", sentence: "Can I play in the sandbox? I love making things with sand!" },
        ],
      },
      {
        word: "Games",
        emoji: "🎲",
        children: [
          { word: "Cards", emoji: "🃏", sentence: "Can we play cards together? That sounds really fun!" },
          { word: "Puzzle", emoji: "🧩", sentence: "I'd like to do a puzzle, can we work on one together?" },
          { word: "Board game", emoji: "🎯", sentence: "Can we play a board game together? Please say yes!" },
          { word: "Video game", emoji: "🕹️", sentence: "Can I play a video game for a little while please?" },
          { word: "Hide and seek", emoji: "🙈", sentence: "Can we play hide and seek? It's my absolute favorite!" },
        ],
      },
      {
        word: "Toys",
        emoji: "🧸",
        children: [
          { word: "Blocks", emoji: "🧱", sentence: "I want to play with my blocks and build something amazing!" },
          { word: "Doll", emoji: "🪆", sentence: "Can I play with my doll please? I have such fun ideas!" },
          { word: "Cars", emoji: "🚗", sentence: "I want to play with my toy cars, that would be so fun!" },
          { word: "Ball", emoji: "⚽", sentence: "Can we play with the ball outside together please?" },
          { word: "LEGO", emoji: "🧩", sentence: "Can I play with LEGO please? I want to build something cool!" },
        ],
      },
      {
        word: "Art",
        emoji: "🎨",
        children: [
          { word: "Drawing", emoji: "✏️", sentence: "Can I do some drawing please? I have such a great idea!" },
          { word: "Painting", emoji: "🖌️", sentence: "I want to paint something, can I please use the paints?" },
          { word: "Play-doh", emoji: "🫧", sentence: "Can I play with Play-doh? I love making fun shapes!" },
          { word: "Coloring", emoji: "🖍️", sentence: "I'd like to do some coloring, can I have a coloring book?" },
          { word: "Stickers", emoji: "⭐", sentence: "Can I use my stickers please? I want to decorate something!" },
        ],
      },
      {
        word: "Music",
        emoji: "🎵",
        children: [
          { word: "Dance", emoji: "💃", sentence: "I want to dance, can we please put on some fun music?" },
          { word: "Sing", emoji: "🎤", sentence: "Can we sing a song together? I love singing so much!" },
          { word: "Drums", emoji: "🥁", sentence: "I want to play the drums, can I please give it a try?" },
          { word: "Piano", emoji: "🎹", sentence: "Can I play on the piano for a little bit please?" },
          { word: "Listen", emoji: "🎧", sentence: "Can we listen to music together? I'd really love that!" },
        ],
      },
    ],
  },
  {
    id: "emotions",
    word: "Emotions",
    emoji: "😊",
    children: [
      {
        word: "Happy",
        emoji: "😊",
        children: [
          { word: "Excited", emoji: "🤩", sentence: "I'm feeling so excited right now, something wonderful is happening!" },
          { word: "Proud", emoji: "🌟", sentence: "I'm really proud of myself today, I did something great!" },
          { word: "Loved", emoji: "🥰", sentence: "I feel so loved and happy right now, thank you so much!" },
          { word: "Playful", emoji: "😜", sentence: "I'm in such a silly playful mood, let's have fun together!" },
          { word: "Grateful", emoji: "🙏", sentence: "I'm feeling so grateful for everything, thank you so much!" },
        ],
      },
      {
        word: "Sad",
        emoji: "😢",
        children: [
          { word: "Hurt", emoji: "💔", sentence: "I'm feeling hurt right now and I really need a big hug." },
          { word: "Lonely", emoji: "😔", sentence: "I'm feeling lonely, can you please come and sit with me?" },
          { word: "Missing someone", emoji: "🫂", sentence: "I'm missing someone special and feeling a little sad inside." },
          { word: "Disappointed", emoji: "😞", sentence: "I feel disappointed right now, it wasn't what I was hoping for." },
          { word: "Scared", emoji: "😨", sentence: "I'm feeling scared right now, can you please help me?" },
        ],
      },
      {
        word: "Angry",
        emoji: "😠",
        children: [
          { word: "Frustrated", emoji: "😤", sentence: "I'm feeling really frustrated right now, I need a moment please." },
          { word: "Annoyed", emoji: "😒", sentence: "Something is bothering me and I'm feeling really annoyed right now." },
          { word: "Overwhelmed", emoji: "😵", sentence: "I'm feeling overwhelmed, there is just too much happening right now." },
          { word: "Left out", emoji: "😟", sentence: "I'm feeling left out and that makes me feel really sad inside." },
          { word: "Not fair", emoji: "😣", sentence: "That doesn't feel fair to me and I'm feeling really upset right now." },
        ],
      },
      {
        word: "Tired",
        emoji: "😴",
        children: [
          { word: "Sleepy", emoji: "😪", sentence: "I'm really sleepy right now, I think I need to rest soon." },
          { word: "Need a break", emoji: "⏸️", sentence: "I need a little break right now, I'm feeling quite tired." },
          { word: "Bored", emoji: "😑", sentence: "I'm feeling bored right now and don't know what to do." },
          { word: "Exhausted", emoji: "🛌", sentence: "I'm really exhausted and I need to rest for a while." },
          { word: "Quiet time", emoji: "🤫", sentence: "I'd like some quiet time please, I need to recharge right now." },
        ],
      },
      {
        word: "Unwell",
        emoji: "🤒",
        children: [
          { word: "Tummy ache", emoji: "🤢", sentence: "My tummy really hurts and I'm not feeling very well right now." },
          { word: "Headache", emoji: "🤕", sentence: "I have a headache, my head is really hurting right now." },
          { word: "Too hot", emoji: "🥵", sentence: "I'm feeling way too hot right now, can we please cool down?" },
          { word: "Too cold", emoji: "🥶", sentence: "I'm feeling really cold right now, can I please have a blanket?" },
          { word: "Not well", emoji: "😷", sentence: "I don't feel very well right now, I think I need to rest." },
        ],
      },
    ],
  },
]

export function loadVocabTree(): VocabCategory[] {
  if (typeof window === "undefined") return DEFAULT_VOCAB_TREE
  try {
    const saved = localStorage.getItem(VOCAB_TREE_KEY)
    if (!saved) return DEFAULT_VOCAB_TREE
    return JSON.parse(saved) as VocabCategory[]
  } catch {
    return DEFAULT_VOCAB_TREE
  }
}

export function saveVocabTree(tree: VocabCategory[]): void {
  localStorage.setItem(VOCAB_TREE_KEY, JSON.stringify(tree))
}
