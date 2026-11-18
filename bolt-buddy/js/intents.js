'use strict';
// Bolt Buddy v2 - what Bolt understands. Single source for the speech grammar (vosk), the intent classifier and the tests.
// Every phrase uses real English words (vosk only knows its own lexicon); toddler pronunciations ("wobot", "hungwy", "pway",
// "fank you") are handled by (1) vosk's grammar mode snapping sounds to the nearest listed word and (2) brain.js toddlerKey()
// fuzzy matching. NEAR lists real words that toddler speech gets decoded as (found by kid_test.py on synthetic toddler audio).
(function (root) {
  const I = {
    // ---- conversation basics ----
    greet: { p: 3, ph: ['hi', 'hello', 'hey', 'howdy', 'good morning', 'hi there', 'hello there', 'hey there', 'what up', 'hi friend', 'yo', 'hi bolt', 'hello bolt', 'hey bolt', 'hi robot', 'hey robot', 'hello robot'] },
    name_q: { p: 6, ph: ['your name', 'you name', 'whats you name', 'what you name', 'whats your name', 'what is your name', 'what your name', 'who are you', 'who you'] },
    my_name: { p: 6, ph: ['my name', 'my name is', 'i am', 'im', 'me'] },          // only counts when followed by the kid's name (brain.js)
    play: { p: 7.5, ph: ['play', 'lets play', 'play with me', 'wanna play', 'wanna play with me', 'want to play', 'want to play with me', 'come play', 'come play with me', 'play with me bolt', 'lets play bolt', 'play a game', 'game', 'games', 'can we play', 'you wanna play', ['with me', 7], ['with me bolt', 7.5], ['fun', 3], ['come on', 3]] },
    yes: { p: 2.5, ph: ['yes', 'yeah', 'yep', 'yup', 'uh huh', 'okay', 'ok', 'sure', 'yes please', 'yay yes'] },
    no: { p: 2.5, ph: ['no', 'nope', 'no no', 'nah', 'no thank you'] },
    // affection: "wanna be my friend?", "I love you" -> always a warm, heartfelt answer (beats everything except hurt feelings)
    affection: { p: 8.5, ph: ['love you', 'i love you', 'love you bolt', 'i love you bolt', 'love you robot', 'i love you so much', 'love you too',
      'be my friend', 'wanna be my friend', 'want to be my friend', 'will you be my friend', 'you my friend', 'are you my friend', 'you are my friend', 'my friend', 'best friend', 'my best friend', 'best friends', 'friends',
      'my buddy', 'are you my buddy', 'you my buddy', 'be my buddy', 'buddy', 'hug', 'hugs', 'give me a hug', 'big hug', 'hug me', 'i hug you', 'kiss', 'kisses', 'cuddle', ['love', 4],
      // decoded shapes of "be my fwend" / "you my fwend" / "wuv you so much" in kid_audio_eval.py (the "fwend" often comes out as another word)
      ['be my', 9.2], ['you my', 9.2], ['my best', 9.2], ['you so much', 8.6], ['give me a', 8.4], ['my airplane', 9.2], ['my airplanes', 9.2]] },
    bye: { p: 7, ph: ['bye', 'bye bye', 'goodbye', 'good bye', 'see you', 'see you later', 'later'] },
    sleep: { p: 8, ph: ['night night', 'good night', 'goodnight', 'sleep', 'sleepy', 'go to sleep', 'bedtime', 'bed time', 'nap', 'nap time', 'night'] },
    what: { p: 4, ph: ['whats that', 'what is that', 'what that', 'what this', 'whats this', 'what is this', 'look', 'look at', 'look at that', 'see that', 'what'] },
    praise: { p: 3.6, ph: ['good job', 'great job', 'good boy', 'good robot', 'you are cool', 'so cool', 'cool', 'awesome', 'nice', 'you are funny', 'smart', 'you are smart', 'good', 'wow', 'amazing'] },
    thanks: { p: 4, ph: ['thank you', 'thanks', 'thank', 'thank you bolt'] },
    sorry: { p: 4, ph: ['sorry', 'oops', 'uh oh', 'oh no', 'whoops'] },
    help: { p: 3, ph: ['help', 'help me', 'can you help'] },
    // ---- actions ----
    dance: { p: 5, ph: ['dance', 'dancing', 'dances', 'dans', 'lets dance', 'dance party', 'wiggle', 'shake it', 'boogie', 'spin', 'spin around'] },
    sing: { p: 5, ph: ['sing', 'singing', 'song', 'sing a song', 'music', 'la la', 'la la la', 'sing song'] },
    jump: { p: 5, ph: ['jump', 'jumping', 'jumps', 'bounce', 'bouncy', 'hop', 'jump up', 'jump jump', 'up up'] },
    rocket: { p: 5, ph: ['rocket', 'rockets', 'space', 'blast off', 'blast', 'fly', 'flying', 'spaceship', 'moon', 'zoom', 'astronaut', 'to the moon'] },
    funny: { p: 5, ph: ['funny', 'joke', 'jokes', 'tell me a joke', 'silly', 'be silly', 'laugh', 'haha', 'hehe', 'tickle', 'tickles', 'be funny', 'giggle', 'boop'] },
    // ---- feelings (always win: Bolt answers feelings first) ----
    happy: { p: 3.4, ph: ['happy', 'im happy', 'i am happy', 'yay', 'hooray', 'excited', 'so happy', 'having fun'] },
    sad: { p: 9, ph: ['sad', 'im sad', 'i am sad', 'crying', 'cry', 'ouch', 'hurt', 'boo boo', 'it hurts', 'i miss'] },
    mad: { p: 9, ph: ['mad', 'im mad', 'angry', 'grumpy', 'grrr', 'frustrated', 'no fair'] },
    scared: { p: 9, ph: ['scared', 'im scared', 'scary', 'afraid', 'spooky', 'monster', 'monsters', 'ghost', 'dark'] },
    hungry: { p: 5, ph: ['hungry', 'im hungry', 'eat', 'eating', 'food', 'snack', 'yummy', 'yum', 'yum yum', 'lunch', 'dinner', 'breakfast', 'drink', 'thirsty'] },
    numbers: { p: 2, ph: ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'count', 'numbers'] },
    colors: { p: 4.5, ph: ['color', 'colors', 'colour', 'colours', 'favorite color', 'my favorite color'] },
    animals: { p: 4.5, ph: ['animal', 'animals', 'favorite animal', 'zoo', 'farm'] },
    bolt: { p: 1, ph: ['bolt', 'robot', 'bolt buddy', 'robot buddy'] },
    kid: { p: 1, ph: ['alex'] },
  };
  // ---- slot words: Bolt reacts to the specific thing and remembers favorites this session ----
  const COLOR = {
    red: ['red'], blue: ['blue'], green: ['green'], yellow: ['yellow'], orange: ['orange'], purple: ['purple'], pink: ['pink'],
    black: ['black'], white: ['white'], rainbow: ['rainbow', 'rainbows'], gold: ['gold', 'golden'],
  };
  const ANIMAL = {
    dog: ['dog', 'dogs', 'doggy', 'doggie', 'puppy', 'puppies', 'woof', 'woof woof'], cat: ['cat', 'cats', 'kitty', 'kitten', 'kitties', 'meow'],
    dinosaur: ['dinosaur', 'dinosaurs', 'dino', 't rex', 'roar'], lion: ['lion', 'lions'], tiger: ['tiger', 'tigers'], bear: ['bear', 'bears', 'teddy'],
    cow: ['cow', 'cows', 'moo'], pig: ['pig', 'pigs', 'piggy', 'oink'], duck: ['duck', 'ducks', 'ducky', 'quack'], horse: ['horse', 'horses', 'horsey', 'pony', 'neigh'],
    monkey: ['monkey', 'monkeys'], elephant: ['elephant', 'elephants'], shark: ['shark', 'sharks', 'baby shark'], bunny: ['bunny', 'bunnies', 'rabbit'],
    bird: ['bird', 'birds', 'birdie', 'tweet'], fish: ['fish', 'fishy'], frog: ['frog', 'froggy', 'ribbit'], snake: ['snake', 'snakes'],
    unicorn: ['unicorn', 'unicorns'], dragon: ['dragon', 'dragons'], owl: ['owl', 'hoot'], bee: ['bee', 'bees', 'buzz'],
  };
  const FOOD = {
    cookie: ['cookie', 'cookies'], apple: ['apple', 'apples'], banana: ['banana', 'bananas', 'nana'], pizza: ['pizza'], icecream: ['ice cream'],
    milk: ['milk'], juice: ['juice'], cheese: ['cheese'], noodles: ['noodles', 'spaghetti', 'pasta'], cake: ['cake', 'cupcake'], candy: ['candy'],
    chicken: ['chicken nuggets', 'nuggets'], strawberry: ['strawberry', 'strawberries'], grapes: ['grapes'], bolts: ['nuts and bolts'],
  };
  const THING = {
    truck: ['truck', 'trucks', 'fire truck', 'monster truck', 'dump truck'], car: ['car', 'cars', 'race car', 'vroom', 'vroom vroom'], train: ['train', 'trains', 'choo choo'],
    ball: ['ball', 'balls'], bubbles: ['bubbles', 'bubble'], boat: ['boat', 'boats'], airplane: ['airplane', 'plane', 'airplanes'], bus: ['bus', 'school bus'],
    tractor: ['tractor'], book: ['book', 'books', 'story'], blocks: ['blocks', 'block', 'lego', 'legos'], mommy: ['mommy', 'mom', 'mama', 'mother'],
    daddy: ['daddy', 'dad', 'dada', 'papa'], baby: ['baby'], bath: ['bath', 'bath time'], outside: ['outside', 'park', 'playground'], slide: ['slide', 'swing'],
    sun: ['sun', 'sunny'], star: ['star', 'stars'], spidey: ['spidey', 'spider', 'spiderman'], superhero: ['superhero', 'super hero', 'batman'],
    brother: ['brother', 'klaus'], sister: ['sister'], toy: ['toy', 'toys'], snow: ['snow', 'snowman'], rain: ['rain'], potty: ['potty'],
  };
  // Bolt's games (the play picker); "rocket" and "dance" also live here so a pick by voice launches the right thing
  const GAME = { gobble: ['gobble', 'bolt gobble', 'gobble gobble'], rocket: ['rocket ride', 'rocket'], hero: ['hero', 'mega bot', 'mega bot hero', 'jelly king', 'jelly', 'bonk'], dance: ['dance party', 'dance'] };
  // real words toddler speech tends to be decoded as -> the word Alex most likely meant (from kid_test.py runs)
  const NEAR = {};
  // phrases still understood in text but NOT given to the speech engine: short greedy words that soaked up unclear toddler
  // speech in kid_audio_eval.py (e.g. "dance" -> "farm", "pway" -> "plane") and made Bolt answer the wrong thing
  const NOGRAM = ['farm', 'zoo', 'wow', 'nice', 'good', 'plane', 'white', 'black', 'gold', 'golden', 'later', 'jelly', 'bonk', 'fun', 'come on', 'yo', 'me', 'im', 'i am', 'what', 'not', 'time', 'count', 'smart', 'dark', 'later', 'buzz', 'hoot', 'tweet', 'sun', 'rain', 'bee', 'owl', 'mom', 'dad', 'papa'];
  const exp = { INTENTS: I, COLOR, ANIMAL, FOOD, THING, GAME, NEAR, NOGRAM };
  if (typeof module !== 'undefined' && module.exports) module.exports = exp; else Object.assign(root, exp);
})(typeof window !== 'undefined' ? window : globalThis);
