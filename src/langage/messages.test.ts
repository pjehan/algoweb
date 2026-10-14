import { describe, expect, it } from 'vitest'
import { compiler } from './index.ts'
import { MESSAGES, type CodeDiagnostic } from './messages.ts'

/** Algorithme principal contenant `instructions`, avec quelques variables déclarées. */
function principal(instructions: string, variables = 'n, i : entier\n  x : réel\n  ch : chaîne\n  L : liste\n  R : liste de réels\n  b : booléen'): string {
  const corps = instructions
    .split('\n')
    .map((l) => '  ' + l)
    .join('\n')
  return `Variables\n  ${variables}\nDébut\n  n ← 1\n  i ← 1\n  x ← 1.5\n  ch ← "a"\n  L ← []\n  R ← []\n  b ← vrai\n${corps}\n  Afficher n, i, x, ch, L, R, b ↵\nFin\n`
}

/**
 * Un exemple par code de diagnostic. La ligne indiquée est celle où le
 * diagnostic doit apparaître.
 */
const CAS: [CodeDiagnostic, string, number][] = [
  // Lexique
  ['chaine-non-fermee', principal('ch ← "abc'), 16],
  ['echappement-inconnu', principal('ch ← "a\\qb"'), 16],
  ['caractere-inconnu', principal('n ← 2 # 3'), 16],
  ['exposant-unicode', principal('x ← x²'), 16],
  ['symbole-etranger', principal('n ← n % 2'), 16],
  ['point-virgule', principal('n ← 1;'), 16],
  ['nombre-colle', principal('n ← 2n'), 16],
  ['notation-pointee', principal('L.append(3)'), 16],
  ['retour-mal-place', principal('Afficher n ↵ ch'), 16],
  // Syntaxe des expressions
  ['expression-attendue', principal('n ← * 2'), 16],
  ['mot-cle-dans-expression', principal('n ← alors + 1'), 16],
  ['parenthese-non-fermee', principal('n ← (1 + 2'), 16],
  ['crochet-non-ferme', principal('n ← L[1'), 16],
  ['appel-invalide', principal('n ← L[0](2)'), 16],
  ['virgule-decimale', principal('x ← 2,5'), 16],
  ['texte-en-trop', principal('n ← 1 2'), 16],
  // Syntaxe des instructions
  ['affectation-egal', principal('n = 3'), 16],
  ['instruction-inconnue', principal('Affiche n'), 16],
  ['expression-sans-effet', principal('n + 1'), 16],
  ['cible-invalide', principal('n + 1 ← 3'), 16],
  ['lire-cible', principal('Lire n + 1'), 16],
  ['afficher-vide', principal('Afficher'), 16],
  ['si-sans-alors', principal('Si n > 0\nFinSi'), 16],
  ['faire-manquant', principal('TantQue n > 0\nFinTantQue'), 16],
  ['pour-mal-forme', principal('Pour i = 1 à 3 faire\nFinPour'), 16],
  ['bloc-non-ferme', principal('Si n > 0 alors\n  n ← 0'), 16],
  ['fermeture-inattendue', principal('FinPour'), 16],
  ['sinon-apres-sinon', principal('Si b alors\nSinon\nSinon si b alors\nFinSi'), 18],
  ['debut-manquant', 'Afficher 1 ↵\nFin\n', 1],
  ['texte-apres-fin', 'Début\nFin\nAfficher 1 ↵\n', 3],
  ['entete-mal-place', 'Début\nFin\nAlgorithme Test\n', 3],
  ['entete-sans-nom', 'Algorithme\nDébut\nFin\n', 1],
  ['variables-mal-placee', principal('Variables'), 16],
  ['declaration-hors-variables', principal('y : entier'), 16],
  ['declaration-mal-formee', 'Variables\n  n, : entier\nDébut\nFin\n', 2],
  ['instruction-dans-variables', 'Variables\n  n : entier\n  n ← 1\nFin\n', 3],
  ['type-inconnu', 'Variables\n  n : entir\nDébut\nFin\n', 2],
  ['entete-sous-programme', 'Fonction f x : réel\nDébut\n  Retourner 1.0\nFinFonction\nDébut\nFin\n', 1],
  ['type-retour-manquant', 'Fonction f(x : réel)\nDébut\n  Retourner x\nFinFonction\nDébut\nFin\n', 1],
  ['type-retour-procedure', 'Procédure p(x : réel) : réel\nDébut\nFinProcédure\nDébut\nFin\n', 1],
  ['fin-sous-programme', 'Procédure p()\nDébut\nFin\nDébut\nFin\n', 3],
  // Noms
  ['nom-non-declare', principal('Afficher m ↵'), 16],
  ['fonction-inconnue', principal('n ← carre(2)'), 16],
  ['variable-hors-portee', 'Fonction f() : entier\nDébut\n  Retourner n\nFinFonction\nVariables\n  n : entier\nDébut\n  n ← f()\nFin\n', 3],
  ['declaration-double', 'Variables\n  n : entier\n  n : réel\nDébut\n  n ← 1\nFin\n', 3],
  ['nom-reserve', 'Variables\n  len : entier\nDébut\nFin\n', 2],
  ['fonction-sans-parentheses', principal('x ← sqrt'), 16],
  ['constante-appelee', principal('x ← pi()'), 16],
  ['variable-appelee', principal('n ← n(2)'), 16],
  // Types
  ['type-affectation', principal('n ← x'), 16],
  ['condition-non-booleenne', principal('Si n alors\nFinSi'), 16],
  ['operande-invalide', principal('ch ← ch + n'), 16],
  ['comparaison-invalide', principal('b ← ch < n'), 16],
  ['indice-non-entier', principal('Afficher R[x] ↵'), 16],
  ['indexation-invalide', principal('Afficher n[0] ↵'), 16],
  ['pour-non-entier', principal('Pour i de 1 à x faire\nFinPour'), 16],
  ['pas-nul', principal('Pour i de 1 à 3 pas de 0 faire\nFinPour'), 16],
  ['compteur-modifie', principal('Pour i de 1 à 3 faire\n  Lire i\nFinPour'), 17],
  ['collection-invalide', principal('Pour chaque i dans n faire\nFinPour'), 16],
  ['arguments-nombre', principal('n ← randint(1)'), 16],
  ['argument-type', principal('x ← sqrt(ch)'), 16],
  ['liste-attendue', principal('ajouter(n, 1)'), 16],
  ['chaine-immuable', principal('ch[0] ← "b"'), 16],
  ['lire-liste', principal('Lire R'), 16],
  ['lire-liste-non-typee', principal('Lire L[0]'), 16],
  // Fonctions et procédures
  ['retour-hors-fonction', principal('Retourner'), 16],
  ['retour-sans-valeur', 'Fonction f() : entier\nDébut\n  Retourner\nFinFonction\nDébut\n  Afficher f() ↵\nFin\n', 3],
  ['retour-dans-procedure', 'Procédure p()\nDébut\n  Retourner 1\nFinProcédure\nDébut\n  p()\nFin\n', 3],
  ['retour-type', 'Fonction f() : entier\nDébut\n  Retourner "a"\nFinFonction\nDébut\n  Afficher f() ↵\nFin\n', 3],
  ['retour-manquant', 'Fonction f(n : entier) : entier\nDébut\n  Si n > 0 alors\n    Retourner 1\n  FinSi\nFinFonction\nDébut\n  Afficher f(1) ↵\nFin\n', 1],
  ['procedure-dans-expression', 'Procédure p()\nDébut\nFinProcédure\nVariables\n  n : entier\nDébut\n  n ← p()\n  Afficher n ↵\nFin\n', 7],
  // Avertissements
  ['variable-inutilisee', 'Variables\n  n : entier\nDébut\nFin\n', 2],
  ['variable-sans-valeur', 'Variables\n  n : entier\nDébut\n  Afficher n ↵\nFin\n', 4],
  ['code-inaccessible', 'Fonction f() : entier\nDébut\n  Retourner 1\n  Afficher 2 ↵\nFinFonction\nDébut\n  Afficher f() ↵\nFin\n', 4],
  ['resultat-ignore', principal('sqrt(4)'), 16],
]

describe('catalogue des messages', () => {
  it.each(CAS)('%s', (code, source, ligne) => {
    const { diagnostics } = compiler(source)
    const trouve = diagnostics.find((d) => d.code === code)
    expect(trouve, `diagnostics obtenus : ${diagnostics.map((d) => d.code).join(', ')}`).toBeDefined()
    expect(trouve!.etendue.ligne).toBe(ligne)
    expect({ message: trouve!.message, suggestion: trouve!.suggestion }).toMatchSnapshot()
  })

  it('chaque code du catalogue a un cas de test', () => {
    const testes = new Set(CAS.map(([code]) => code))
    const manquants = Object.keys(MESSAGES).filter((code) => !testes.has(code as CodeDiagnostic))
    expect(manquants).toEqual([])
  })

  it('les cas de référence ne produisent pas d’autre erreur que celle attendue', () => {
    // Garantit que les exemples testent bien le message visé, et non une erreur en cascade.
    for (const [code, source] of CAS) {
      const erreurs = compiler(source).diagnostics.filter((d) => d.gravite === 'erreur' && d.code !== code)
      expect(erreurs.map((d) => `${code} → ${d.code} : ${d.message}`)).toEqual([])
    }
  })
})
