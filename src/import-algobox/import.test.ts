import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { executerConsole } from '../execution/index.ts'
import { analyser, compiler, formater } from '../langage/index.ts'
import { analyserExpressionAB, decouperHorsGroupes } from './expressions.ts'
import { ErreurAlg, importerAlg, nomDepuisFichier } from './index.ts'
import { lireXml } from './xml.ts'

const DOSSIER = join(import.meta.dirname, '../../tests/algobox')

// ---------------------------------------------------------------- Construction de fichiers .alg

function echapper(texte: string): string {
  return texte.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Ligne `<item>` : code et enfants. Le texte affiché ne sert qu'aux blocs de premier niveau. */
function item(code: string, ...enfants: string[]): string {
  return element(code, code, enfants)
}

function element(texte: string, code: string, enfants: string[]): string {
  const attributs = `algoitem="${echapper(texte)}" code="${echapper(code)}"`
  return enfants.length === 0 ? `<item ${attributs}/>` : `<item ${attributs}>${enfants.join('')}</item>`
}

/** Fichier `.alg` minimal. */
function alg({ variables = [] as string[], instructions = [] as string[], fonctions = [] as string[], config = '' }): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Algo>
  <description texte="" courant=""/>${config}
  ${element('FONCTIONS_UTILISEES', '200#declarationfonctions', fonctions)}
  ${element('VARIABLES', '100#declarationsvariables', variables)}
  ${element('DEBUT_ALGORITHME', '101#debutalgo', instructions)}
  ${element('FIN_ALGORITHME', '102#finalgo', [])}
</Algo>`
}

const nombre = (nom: string) => item(`1#NOMBRE#${nom}`)

/** Lignes du corps de l'algorithme principal, sans indentation. */
function corps(code: string): string[] {
  const lignes = code.split('\n')
  const debut = lignes.lastIndexOf('Début')
  return lignes.slice(debut + 1, lignes.lastIndexOf('Fin')).map((l) => l.trim())
}

/** Conversion de `AFFICHERCALCUL expression`, avec les variables données. */
function calcul(expression: string, variables = ['a', 'b'], chaines: string[] = [], listes: string[] = []): string {
  const r = importerAlg(
    alg({
      variables: [...variables.map(nombre), ...chaines.map((c) => item(`1#CHAINE#${c}`)), ...listes.map((l) => item(`1#LISTE#${l}`))],
      instructions: [item(`20#${expression}#0`)],
    }),
    'essai.alg',
  )
  return corps(r.code).filter((l) => !l.endsWith('← []')).join('\n').replace(/^Afficher /, '')
}

// ---------------------------------------------------------------- Lecture

describe('lecteur XML', () => {
  it('lit éléments, attributs et entités', () => {
    const e = lireXml(`<?xml version="1.0"?><!-- commentaire --><a x='1' y="&lt;&amp;&#233;&#xa;&quot;"><b/><c z="2"></c></a>`)
    expect(e).toEqual({
      nom: 'a',
      attributs: { x: '1', y: '<&é\n"' },
      enfants: [
        { nom: 'b', attributs: {}, enfants: [] },
        { nom: 'c', attributs: { z: '2' }, enfants: [] },
      ],
    })
  })

  it('normalise les blancs littéraux des attributs', () => {
    expect(lireXml('<a t="un\ndeux"/>').attributs.t).toBe('un deux')
  })

  it.each([
    ['<a><b></a>', 'Balise fermante </a> inattendue.'],
    ['<a>', 'Balise <a> non fermée.'],
    ['<a x="1/>', 'Le fichier est incomplet.'],
    ['texte', 'Le fichier ne contient aucun élément XML.'],
    ['<a/><b/>', 'Le fichier contient plusieurs éléments racines.'],
  ])('signale un XML mal formé : %s', (texte, message) => {
    expect(() => lireXml(texte)).toThrow(message)
  })

  it('refuse un fichier qui n’est pas un algorithme AlgoBox', () => {
    expect(() => importerAlg('<html/>', 'a.alg')).toThrow(ErreurAlg)
    expect(() => importerAlg('pas du XML', 'a.alg')).toThrow(/n’est pas un fichier AlgoBox valide/)
  })

  it('tire le nom de l’algorithme du nom du fichier', () => {
    expect(nomDepuisFichier('Mes algos/Suite de Syracuse.ALG')).toBe('Suite de Syracuse')
    expect(nomDepuisFichier('.alg')).toBe('Algorithme importé')
  })
})

describe('expressions AlgoBox', () => {
  it('respecte les priorités de JavaScript', () => {
    expect(analyserExpressionAB('1+2*3')).toMatchObject({ g: 'binaire', op: '+', droite: { g: 'binaire', op: '*' } })
    expect(analyserExpressionAB('a<b ET c OU d')).toMatchObject({ g: 'binaire', op: '||', gauche: { g: 'binaire', op: '&&' } })
    expect(analyserExpressionAB('-x.length')).toMatchObject({ g: 'unaire', operande: { g: 'membre', nom: 'length' } })
  })

  it('lit les chaînes entre guillemets simples ou doubles, avec échappements', () => {
    expect(analyserExpressionAB(`'l\\'arbre'`)).toEqual({ g: 'chaine', valeur: "l'arbre" })
    expect(analyserExpressionAB('"a\\"b\\n"')).toEqual({ g: 'chaine', valeur: 'a"b\n' })
  })

  it('refuse une expression incomplète', () => {
    expect(() => analyserExpressionAB('(a+')).toThrow()
    expect(() => analyserExpressionAB('a b')).toThrow()
    expect(() => analyserExpressionAB('"a')).toThrow()
  })

  it('découpe hors des groupes', () => {
    expect(decouperHorsGroupes('1:f(a,b):"x:y":L[2]', ':')).toEqual(['1', 'f(a,b)', '"x:y"', 'L[2]'])
  })
})

// ---------------------------------------------------------------- Conversion des expressions

describe('conversion des expressions', () => {
  it.each([
    ['a==b', 'a = b'],
    ['a!=b', 'a ≠ b'],
    ['a<=b && a>=0 || !(b<1)', 'a ≤ b et a ≥ 0 ou non b < 1'],
    ['a<b ET b<3 OU a==0', 'a < b et b < 3 ou a = 0'],
    ['(a<b) == (b<a)', '(a < b) = (b < a)'],
    ['a%2', 'a mod 2'],
    ['pow(a+1,2)', '(a + 1)^2'],
    ['-pow(a,2)', '-a^2'],
    ['pow(-a,b)', '(-a)^b'],
    ['Math.PI*sqrt(a)+Math.sqrt(b)+SQRT(a)+Sqrt(b)', 'pi * sqrt(a) + sqrt(b) + sqrt(a) + sqrt(b)'],
    ['Math.floor(a/2)+Math.ceil(b)+Math.abs(a)+Math.max(a,b)', 'floor(a / 2) + ceil(b) + abs(a) + max(a, b)'],
    ['random()+Math.random()', 'random() + random()'],
    ['cos(a)+sin(a)+tan(a)+acos(a)+asin(a)+atan(a)+exp(a)+log(a)', 'cos(a) + sin(a) + tan(a) + acos(a) + asin(a) + atan(a) + exp(a) + log(a)'],
    ['a-(b-1)', 'a - (b - 1)'],
    ['a/(b*2)', 'a / (b * 2)'],
    ['.5+2.', '0.5 + 2.0'],
    ['1e3', '1e3'],
    ['ALGOBOX_ALEA_ENT(1,a)', 'randint(1, a)'],
    ['ALGOBOX_ARRONDIR(a/3,2)', 'round(a / 3, 2)'],
    ['true', 'vrai'],
  ])('%s → %s', (expression, attendu) => {
    expect(calcul(expression)).toBe(attendu)
  })

  it.each([
    ['ch.length', 'len(ch)'],
    ['ch.substr(1,3)', 'ch[1:4]'],
    ['ch.substr(0,a)', 'ch[0:a]'],
    ['ch.substr(a,2)', 'ch[a:a + 2]'],
    ['ch.substr(2)', 'ch[2:]'],
    ['ch.substring(1,3)', 'ch[1:3]'],
    ['ch.charAt(a)', 'ch[a]'],
    ['ch.charCodeAt(0)', 'ord(ch[0])'],
    ['String.fromCharCode(65+a)', 'chr(65 + a)'],
    ['a.toString()', 'str(a)'],
    ['"n = "+a', '"n = " + str(a)'],
    ['"n = "+a+1', '"n = " + str(a) + str(1)'],
    ['a+1+"!"', 'str(a + 1) + "!"'],
    ['ch+"x"+ch', 'ch + "x" + ch'],
    ["'il dit \"oui\"'", '"il dit \\"oui\\""'],
  ])('chaînes : %s → %s', (expression, attendu) => {
    expect(calcul(expression, ['a'], ['ch'])).toBe(attendu)
  })

  it.each([
    ['ALGOBOX_SOMME(L,0,a)', 'sum(L[0:a + 1])'],
    ['ALGOBOX_MAXIMUM(L,1,3)', 'max(L[1:4])'],
    ['ALGOBOX_MINIMUM(L,0,2)', 'min(L[0:3])'],
    ['ALGOBOX_MOYENNE(L,0,2)', 'sum(L[0:3]) / len(L[0:3])'],
    ['L[a]', 'L[a]'],
    ['L.length', 'len(L)'],
  ])('listes : %s → %s', (expression, attendu) => {
    expect(calcul(expression, ['a'], [], ['L'])).toBe(attendu)
  })

  it('garde en commentaire une ligne illisible, et le signale', () => {
    const r = importerAlg(alg({ variables: [nombre('a')], instructions: [item('5#a#(a+#pasliste'), item('20#a.toFixed(2)#1')] }), 'x.alg')
    expect(corps(r.code)).toEqual(['// [AlgoBox, non converti] 5#a#(a+#pasliste', '// [AlgoBox, non converti] 20#a.toFixed(2)#1'])
    expect(r.rapport.points.map((p) => p.message)).toEqual([
      'Expression illisible : « (a+ ».',
      'Ligne gardée en commentaire, car elle n’a pas pu être convertie : réécrivez-la.',
      'Expression JavaScript non convertie : « .toFixed(…) ».',
    ])
    expect(analyser(r.code).diagnostics).toEqual([])
  })

  it('signale « ^ », le « ou exclusif » d’AlgoBox, sans le convertir', () => {
    const r = importerAlg(alg({ variables: [nombre('a')], instructions: [item('20#a^2#1')] }), 'x.alg')
    expect(corps(r.code)).toEqual(['Afficher a^2 ↵'])
    expect(r.rapport.points).toEqual([{ lignes: [6], message: expect.stringContaining('ou exclusif') }])
  })

  it('garde les autres fonctions ALGOBOX_* et les signale', () => {
    const r = importerAlg(alg({ variables: [nombre('a')], instructions: [item('20#ALGOBOX_FACTORIELLE(a)#1')] }), 'x.alg')
    expect(corps(r.code)).toEqual(['Afficher ALGOBOX_FACTORIELLE(a) ↵'])
    expect(r.rapport.points[0].message).toBe('Fonction AlgoBox non convertie : ALGOBOX_FACTORIELLE.')
  })
})

// ---------------------------------------------------------------- Types et noms

describe('déduction des types', () => {
  const types = (r: ReturnType<typeof importerAlg>) => Object.fromEntries(r.rapport.types.map((t) => [`${t.portee ?? ''}.${t.nom}`, t.type]))

  it('entier si la variable ne reçoit que des entiers, réel sinon, par propagation', () => {
    const r = importerAlg(
      alg({
        variables: ['a', 'b', 'c', 'd'].map(nombre),
        instructions: [item('5#a#3#pasliste'), item('5#b#a*2#pasliste'), item('5#c#b/2#pasliste'), item('5#d#c+1#pasliste')],
      }),
      'x.alg',
    )
    expect(types(r)).toEqual({ '.a': 'entier', '.b': 'entier', '.c': 'réel', '.d': 'réel' })
  })

  it('une variable lue est réelle, sauf si elle sert de borne, d’indice ou d’opérande de mod', () => {
    const r = importerAlg(
      alg({
        variables: ['x', 'n', 'm', 'i', 'k'].map(nombre).concat(item('1#LISTE#L')),
        instructions: [
          item('2#x#pasliste'),
          item('2#n#pasliste'),
          item('2#m#pasliste'),
          item('2#k#pasliste'),
          item('12#i#0#n-1', item('13#debutpour'), item('3#L#1#i+m'), item('14#finpour')),
          item('20#k%2#1'),
        ],
      }),
      'x.alg',
    )
    expect(types(r)).toMatchObject({ '.x': 'réel', '.n': 'entier', '.m': 'entier', '.i': 'entier', '.k': 'entier' })
  })

  it('une valeur réelle se propage par affectation ; une borne réelle est arrondie', () => {
    const r = importerAlg(
      alg({
        variables: ['n', 'p', 'i'].map(nombre),
        instructions: [item('2#n#pasliste'), item('5#p#n#pasliste'), item('12#i#1#p', item('13#debutpour'), item('14#finpour'))],
      }),
      'x.alg',
    )
    expect(types(r)).toEqual({ '.n': 'réel', '.p': 'réel', '.i': 'entier' })
    expect(corps(r.code)).toEqual(['Lire n', 'p ← n', 'Pour i de 1 à floor(p) faire', 'FinPour'])
    expect(compiler(r.code).diagnostics).toEqual([])
  })

  it('les paramètres prennent le type des arguments ; les listes partagent le type de leurs éléments', () => {
    const r = importerAlg(
      alg({
        fonctions: [
          item('201#f#p,q,T', item('202#declarationsvariablesfonction'), item('203#debutfonction'), item('205#p+T[0]'), item('204#finfonction')),
          item('201#g#u', item('202#declarationsvariablesfonction'), item('203#debutfonction'), item('205#u'), item('204#finfonction')),
          item('201#h#v', item('202#declarationsvariablesfonction'), item('203#debutfonction'), item('3#v#1#pasliste'), item('204#finfonction')),
        ],
        variables: [nombre('a'), item('1#CHAINE#s'), item('1#LISTE#L')],
        instructions: [item('5#L#1.5#0'), item('5#a#f(2,s,L)#pasliste'), item('206#h(a)')],
      }),
      'x.alg',
    )
    expect(types(r)).toEqual({
      'f.p': 'entier',
      'f.q': 'chaîne',
      'f.T': 'liste de réels',
      'f.valeur renvoyée': 'réel',
      'g.u': 'réel',
      'g.valeur renvoyée': 'réel',
      'h.v': 'réel',
      '.a': 'réel',
      '.s': 'chaîne',
      '.L': 'liste de réels',
    })
    expect(r.code).toContain('Procédure h(v : réel)')
  })

  it('la borne de fin réelle d’un Pour est arrondie par floor', () => {
    const r = importerAlg(
      alg({ variables: ['n', 'i'].map(nombre), instructions: [item('5#n#7/2#pasliste'), item('12#i#1#n', item('13#debutpour'), item('14#finpour'))] }),
      'x.alg',
    )
    expect(corps(r.code)).toEqual(['n ← 7 / 2', 'Pour i de 1 à floor(n) faire', 'FinPour'])
    expect(compiler(r.code).diagnostics.filter((d) => d.gravite === 'erreur')).toEqual([])
  })

  it('signale une borne ou un compteur modifiés dans la boucle', () => {
    const r = importerAlg(
      alg({
        variables: ['n', 'i'].map(nombre),
        instructions: [item('5#n#5#pasliste'), item('12#i#1#n', item('13#debutpour'), item('5#n#n-1#pasliste'), item('5#i#i+1#pasliste'), item('14#finpour'))],
      }),
      'x.alg',
    )
    expect(r.rapport.points.map((p) => [p.lignes, p.message.slice(0, 30)])).toEqual([
      [[8], 'La borne de fin est modifiée d'],
      [[8], 'Le compteur i est modifié dans'],
    ])
  })
})

describe('noms', () => {
  it('renomme les noms réservés par AlgoWeb, sans créer de doublon', () => {
    const r = importerAlg(
      alg({
        fonctions: [item('201#somme#liste', item('202#declarationsvariablesfonction'), item('203#debutfonction'), item('205#liste'), item('204#finfonction'))],
        variables: ['fin', 'fin_', 'Si', 'print', 'len'].map(nombre),
        instructions: [item('5#fin#somme(1)#pasliste'), item('3#len#1#pasliste')],
      }),
      'x.alg',
    )
    expect(r.code).toContain('Fonction somme_(liste_ : entier) : entier')
    expect(r.code).toContain('fin_2 ← somme_(1)')
    expect(r.rapport.types.filter((t) => t.portee === null).map((t) => t.nom)).toEqual(['fin_2', 'fin_', 'Si_', 'print_', 'len_'])
    expect(r.rapport.points.map((p) => p.message)).toEqual([
      '« somme » (fonction) devient « somme_ » : ce nom est réservé dans AlgoWeb.',
      '« fin » (variable) devient « fin_2 » : ce nom est réservé dans AlgoWeb.',
      '« Si » (variable) devient « Si_ » : ce nom est réservé dans AlgoWeb.',
      '« print » (variable) devient « print_ » : ce nom est réservé dans AlgoWeb.',
      '« len » (variable) devient « len_ » : ce nom est réservé dans AlgoWeb.',
      '« liste » (paramètre de somme_) devient « liste_ » : ce nom est réservé dans AlgoWeb.',
    ])
  })
})

// ---------------------------------------------------------------- Fichiers de test

describe('fichiers de test', () => {
  const fichiers = readdirSync(DOSSIER).filter((f) => f.endsWith('.alg'))

  it.each(fichiers)('%s : texte et rapport attendus', async (fichier) => {
    const r = importerAlg(readFileSync(join(DOSSIER, fichier), 'utf8'), fichier)
    await expect(r.code).toMatchFileSnapshot(join(DOSSIER, fichier.replace(/\.alg$/, '.algo')))
    await expect(JSON.stringify({ description: r.description, rapport: r.rapport }, null, 2) + '\n').toMatchFileSnapshot(
      join(DOSSIER, fichier.replace(/\.alg$/, '.rapport.json')),
    )
  })

  it.each(fichiers)('%s : texte déjà mis en forme', (fichier) => {
    const { code } = importerAlg(readFileSync(join(DOSSIER, fichier), 'utf8'), fichier)
    const { programme, diagnostics } = analyser(code)
    expect(diagnostics).toEqual([])
    expect(formater(programme)).toBe(code)
  })

  it('les algorithmes sans point particulier compilent sans aucun diagnostic', () => {
    for (const fichier of ['moyenne.alg', 'ancien.alg']) {
      expect(compiler(importerAlg(readFileSync(join(DOSSIER, fichier), 'utf8'), fichier).code).diagnostics).toEqual([])
    }
  })

  it('l’algorithme importé s’exécute comme dans AlgoBox', () => {
    const { code } = importerAlg(readFileSync(join(DOSSIER, 'moyenne.alg'), 'utf8'), 'moyenne.alg')
    const r = executerConsole(code, ['Ada', '3', '12', '8', '17.5'])
    expect(r.erreur).toBeUndefined()
    expect(r.sortie).toContain('Bonjour Ada\nMoyenne : 12.5\nAdmis\n66.66666666666667 % de notes au-dessus de 10\n321')
    expect(r.sortie.endsWith('\nFin\n')).toBe(true)
  })

  it('ancien.alg : SINON placé après le SI, éléments de configuration manquants', () => {
    const { code } = importerAlg(readFileSync(join(DOSSIER, 'ancien.alg'), 'utf8'), 'ancien.alg')
    expect(executerConsole(code, ['7']).sortie).toBe('t = 7 14 21 28 35 42 49 56 63 70 \nimpair\n')
  })
})
