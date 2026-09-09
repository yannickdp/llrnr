/* messages.js — everything the coach says. Data, deliberately.

   Not one line of logic lives in this file, and that is the point. The coach's
   one honest weakness is novelty decay: at roughly a dozen appearances a lesson
   she works through the whole repertoire fast, and after that it is decoration
   rather than reward (PLAN-ROMA section 9). The mitigation needs no code — it
   needs more entries here — so this is the file to open when the coach starts
   feeling stale, and adding to it is safe for anyone, including her.

   The spec shipped 21 messages, which is about a week. This ships roughly
   three times that, which is about a month. It never becomes a year-long arc
   and should not be asked to be one; the city is what carries the school year.

   Two rules for anything added here:

   - **The Dutch is Flemish.** "Allez", "goe bezig", "straf" — this is how she
     and her friends actually talk, and a coach speaking Dutch Dutch would read
     as a stranger. PLAN section 1.
   - **The Latin is real.** Every `la` is an attested phrase or a plain,
     grammatical sentence, because she will show one to her teacher sooner or
     later and the app cannot be the thing that was wrong. The `tr` is what it
     actually means, not a loose gloss — absorbing twenty real phrases with
     their translations at the moment she is receptive is most of why the coach
     is worth having at all.

   A message with no `la` is fine and there are several on purpose: an
   unbroken run of mottos reads as a fortune cookie machine. */

/**
 * The ranks, low to high. Names and glosses only — what XP each one costs is
 * derived from the city's stages in coach.js, because a second XP ladder is
 * exactly what PLAN section 1 trimmed the app down to avoid.
 *
 * Glossed in Dutch like the city's buildings are, and for the same reason:
 * `centurio` is a hundred-man officer, and knowing that is worth as much as
 * any word on the list.
 */
export const RANKS = Object.freeze([
  { id: 'servus', latin: 'Servus', dutch: 'de slaaf' },
  { id: 'gladiator', latin: 'Gladiator', dutch: 'de zwaardvechter' },
  { id: 'centurio', latin: 'Centurio', dutch: 'de honderdman' },
  { id: 'magister', latin: 'Magister', dutch: 'de leermeester' },
  { id: 'senator', latin: 'Senator', dutch: 'de raadsheer' },
  { id: 'imperator', latin: 'Imperator', dutch: 'de keizer' },
]);

/**
 * What the coach says, by mood.
 *
 * `good`    — right, but with the four options in front of her or on a repeat
 * `improve` — an almost or a miss; the reveal carries the correction, this
 *             carries only the encouragement
 * `perfect` — a clean recall, typed, first time this lesson
 */
export const MSG = Object.freeze({
  good: Object.freeze([
    { nl: 'Uitstekend! Zo ken ik je.' },
    { nl: 'Schitterend gedaan!', la: 'Veni, vidi, vici', tr: 'Ik kwam, ik zag, ik overwon.' },
    { nl: 'Goed zo — Caesar zou tevreden zijn.' },
    { nl: 'Knap werk, blijf zo doorgaan!', la: 'Per aspera ad astra', tr: 'Door moeilijkheden naar de sterren.' },
    { nl: 'Je Latijn wordt sterk!', la: 'Fortes fortuna adiuvat', tr: 'Het geluk helpt de dapperen.' },
    { nl: 'Allez, goe bezig!' },
    { nl: 'Mooi. Pak die dag.', la: 'Carpe diem', tr: 'Pluk de dag.' },
    { nl: 'Een echte Romein waardig!' },
    { nl: 'Dat zit goed.', la: 'Gutta cavat lapidem', tr: 'De druppel holt de steen uit.' },
    { nl: 'Stap voor stap geraak je er.', la: 'Paulatim', tr: 'Beetje bij beetje.' },
    { nl: 'Je hebt het beet.', la: 'Labor omnia vincit', tr: 'Werk overwint alles.' },
    { nl: 'Goed onthouden!', la: 'Repetita iuvant', tr: 'Herhalen helpt.' },
    { nl: 'Dat mag gezien worden.' },
    { nl: 'Zo bouw je een woordenschat op.', la: 'Roma non uno die aedificata est', tr: 'Rome is niet op één dag gebouwd.' },
    { nl: 'Prima.', la: 'Bene fecisti', tr: 'Je hebt het goed gedaan.' },
    { nl: 'Daar is het.' },
    { nl: 'Weer een woord dat blijft plakken.', la: 'Verba volant, scripta manent', tr: 'Woorden vervliegen, geschreven tekst blijft.' },
    { nl: 'Chapeau!', la: 'Macte animo', tr: 'Goed zo, hou moed.' },
    { nl: 'Dat had je door.', la: 'Sapere aude', tr: 'Durf te denken.' },
    { nl: 'Weer een stukje Rome erbij.' },
    { nl: 'Kalm en juist — de beste combinatie.', la: 'Suaviter in modo, fortiter in re', tr: 'Zacht in de manier, sterk in de zaak.' },
    { nl: 'Ge zijt goe bezig, echt waar.' },
  ]),

  improve: Object.freeze([
    { nl: 'Kom op, je kan dit!', la: 'Errare humanum est', tr: 'Vergissen is menselijk.' },
    { nl: 'Bijna! Probeer nog eens.', la: 'Repetitio mater studiorum', tr: 'Herhaling is de moeder van de studie.' },
    { nl: 'Niet opgeven — oefening baart kunst!', la: 'Nulla dies sine linea', tr: 'Geen dag zonder een streep.' },
    { nl: 'Rustig aan, je geraakt er wel.', la: 'Festina lente', tr: 'Haast je langzaam.' },
    { nl: 'Concentreer je, je bent er bijna.' },
    { nl: 'Allez, doorzetten!', la: 'Non scholae sed vitae discimus', tr: 'We leren niet voor de school, maar voor het leven.' },
    { nl: 'Nog een poging, discipula!' },
    { nl: 'Blijf oefenen, het komt wel goed.' },
    { nl: 'Fout gemaakt? Dan heb je iets geleerd.', la: 'Errando discimus', tr: 'Al dwalend leren we.' },
    { nl: 'Zo wordt een mens goed in iets.', la: 'Fabricando fit faber', tr: 'Al smedend wordt men smid.' },
    { nl: 'Dat was net niet. Nog eens.' },
    { nl: 'Elke meester is ooit begonnen.', la: 'Nemo nascitur artifex', tr: 'Niemand wordt als meester geboren.' },
    { nl: 'Kop op, dat lukt straks wel.' },
    { nl: 'Adem in. En nog eens.', la: 'Dum spiro, spero', tr: 'Zolang ik adem, hoop ik.' },
    { nl: 'Je bent dichterbij dan je denkt.' },
    { nl: 'Niks aan de hand. Volgende keer.' },
    { nl: 'Struikelen hoort erbij.', la: 'Bis vincit qui se vincit', tr: 'Tweemaal overwint wie zichzelf overwint.' },
    { nl: 'Blijf erbij, het zit er wel in.', la: 'Perfer et obdura', tr: 'Hou vol en bijt door.' },
    { nl: 'Deze pakken we straks terug.' },
    { nl: 'Moeilijk? Dan is het het leren waard.', la: 'Difficilia quae pulchra', tr: 'Wat mooi is, is moeilijk.' },
    { nl: 'Nog eens, met je hoofd erbij.', la: 'Age quod agis', tr: 'Doe wat je doet.' },
    { nl: 'Morgen weet je dit wel.', la: 'Cras melius erit', tr: 'Morgen zal het beter zijn.' },
  ]),

  perfect: Object.freeze([
    { nl: 'PERFECT! Vlekkeloos gedaan!', la: 'Summa cum laude', tr: 'Met de hoogste lof.' },
    { nl: 'Onberispelijk! Een god waardig.', la: 'Ad astra!', tr: 'Naar de sterren!' },
    { nl: 'Foutloos! Jupiter lacht.', la: 'Victoria!', tr: 'Overwinning!' },
    { nl: 'Meesterlijk gedaan.' },
    { nl: 'Zo doet een keizer het!', la: 'Aquila non capit muscas', tr: 'De adelaar vangt geen vliegen.' },
    { nl: 'Uit het hoofd, in één keer.', la: 'Sine dubio', tr: 'Zonder twijfel.' },
    { nl: 'Dat was zuiver.', la: 'Optime!', tr: 'Uitstekend!' },
    { nl: 'Niks op aan te merken.', la: 'Nihil obstat', tr: 'Niets staat in de weg.' },
    { nl: 'Je kent dat woord nu écht.' },
    { nl: 'In één keer juist. Straf.' },
    { nl: 'Dat is beheersing.', la: 'Euge!', tr: 'Bravo!' },
    { nl: 'Feilloos!', la: 'Sine errore', tr: 'Zonder één fout.' },
    { nl: 'Zo klinkt Latijn.', la: 'Lingua Latina viva est', tr: 'Het Latijn leeft.' },
    { nl: 'Straf gedaan!', la: 'Macte virtute', tr: 'Bravo, ga zo door.' },
    { nl: 'Recht in de roos.', la: 'Rem acu tetigisti', tr: 'Je hebt de zaak met de naald geraakt.' },
    { nl: 'Dat was echt goed.' },
    { nl: 'De hele stad heeft het gehoord.' },
    { nl: 'Zonder aarzelen. Mooi.', la: 'Fortiter et recte', tr: 'Dapper en juist.' },
  ]),
});

/**
 * One line per rank, said the once, when she reaches it.
 *
 * There is no entry for `servus` on purpose: it is where everyone starts and
 * arriving somewhere you were already standing is not an unlock.
 */
export const UNLOCK = Object.freeze({
  gladiator: { nl: 'Je bent nu Gladiator. Vecht voor je Latijn.', la: 'Ad arenam!', tr: 'Naar de arena!' },
  centurio: { nl: 'Rang behaald: Centurio. Leid je woorden.', la: 'Sequere me', tr: 'Volg mij.' },
  magister: { nl: 'Je bent nu Magister. Echte wijsheid wacht.', la: 'Scientia potentia est', tr: 'Kennis is macht.' },
  senator: { nl: 'Verheven tot Senator. De stad luistert.', la: 'Pro bono publico', tr: 'Voor het algemeen belang.' },
  imperator: { nl: 'Ave! Je heerst over het Latijn.', la: 'Alea iacta est', tr: 'De teerling is geworpen.' },
});
