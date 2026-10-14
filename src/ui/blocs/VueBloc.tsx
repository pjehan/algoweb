import { useDraggable, useDroppable } from '@dnd-kit/core'
import { Fragment, useContext, useState, type ReactNode } from 'react'
import { fermerMenu } from '../actions.ts'
import { modeles, texteSimple } from '../editeur/modeles.ts'
import { useEtat } from '../etat.ts'
import { Champ } from './Champ.tsx'
import { Blocs, type ContexteBlocs } from './contexte.ts'
import type { Bloc, CorpsBlocs, LigneVariables, SousProgrammeBlocs } from './modele.ts'
import {
  ajouterDeclaration,
  ajouterSinon,
  ajouterSinonSi,
  blocsDepuisTexte,
  commenter,
  decaler,
  dupliquer,
  inserer,
  modifier,
  modifierLigneVariables,
  modifierSousProgramme,
  supprimer,
  supprimerBranche,
  supprimerLigneVariables,
  supprimerSousProgramme,
  type CleListe,
} from './operations.ts'

function useBlocs(): ContexteBlocs {
  return useContext(Blocs)!
}

/** Modèles de la palette qui deviennent des blocs d'instructions. */
export const MODELES_HORS_INSTRUCTIONS = new Set(['Section Variables', 'Déclarer une variable', 'Fonction', 'Procédure', 'Sinon si'])

// ---------------------------------------------------------------- Insertion

function MenuInsertion({ cle, index, fermer }: { cle: CleListe; index: number; fermer: () => void }) {
  const ctx = useBlocs()
  const notation = useEtat((e) => e.preferences.notation)
  const liste = modeles(notation).filter((m) => m.bloc && !MODELES_HORS_INSTRUCTIONS.has(m.libelle))
  return (
    <div className="menu-insertion" role="group" aria-label="Instruction à insérer" onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), fermer())}>
      {liste.map((m) => (
        <button
          key={m.libelle}
          type="button"
          title={m.description}
          onClick={() => {
            const blocs = blocsDepuisTexte(texteSimple(m.modele), notation)
            if (blocs) {
              ctx.appliquer(inserer(ctx.modele, cle, index, blocs))
              ctx.focaliser(blocs[0].id, true)
            }
            fermer()
          }}
        >
          {m.libelle}
        </button>
      ))}
    </div>
  )
}

/**
 * Point d'insertion avant un bloc (ou en fin de liste) : cible du
 * glisser-déposer, et bouton « + » pour la souris. Au clavier, on insère avec
 * la palette, après le bloc qui a le focus.
 */
function PointInsertion({ cle, index }: { cle: CleListe; index: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${cle}|${index}` })
  const [ouvert, setOuvert] = useState(false)
  return (
    <div ref={setNodeRef} className={`point-insertion${isOver ? ' survol' : ''}${ouvert ? ' ouvert' : ''}`}>
      <button type="button" tabIndex={-1} aria-label="Insérer une instruction ici" title="Insérer une instruction ici" onClick={() => setOuvert(!ouvert)}>
        +
      </button>
      {ouvert && <MenuInsertion cle={cle} index={index} fermer={() => setOuvert(false)} />}
    </div>
  )
}

export function ListeBlocs({ cle, blocs, niveau }: { cle: CleListe; blocs: Bloc[]; niveau: number }) {
  return (
    <ul className="liste-blocs">
      {blocs.map((b, k) => (
        <VueBloc key={b.id} bloc={b} niveau={niveau} insertion={<PointInsertion cle={cle} index={k} />} />
      ))}
      <li className="fin-liste">
        <PointInsertion cle={cle} index={blocs.length} />
        {blocs.length === 0 && <span className="liste-vide">Aucune instruction : utilisez « + » ou la palette.</span>}
      </li>
    </ul>
  )
}

// ---------------------------------------------------------------- Bloc

/** Ligne d'un bloc : poignée de déplacement, contenu, marques et menu. */
function Ligne({ id, children, menu = true, poignee = true }: { id: string; children: ReactNode; menu?: boolean; poignee?: boolean }) {
  const ctx = useBlocs()
  const ligne = ctx.lignes.get(id)
  const { attributes, listeners, setNodeRef } = useDraggable({ id, disabled: !poignee })
  return (
    <div className={`ligne-bloc${ligne !== undefined && ligne === ctx.ligneCourante ? ' bloc-courant' : ''}`}>
      {poignee ? (
        <button type="button" ref={setNodeRef} className="poignee" aria-label="Déplacer (glisser, ou Alt+flèches sur la ligne)" {...attributes} {...listeners} tabIndex={-1}>
          ⠿
        </button>
      ) : (
        <span className="poignee" aria-hidden="true" />
      )}
      {ligne !== undefined && ctx.pointsArret.has(ligne) ? (
        <span className="point-arret" title="Point d’arrêt">
          ●<span className="visuellement-cache"> point d’arrêt</span>
        </span>
      ) : (
        <span className="point-arret" aria-hidden="true" />
      )}
      <span className="contenu-bloc">{children}</span>
      {menu && <MenuBloc id={id} />}
    </div>
  )
}

function MenuBloc({ id }: { id: string }) {
  const ctx = useBlocs()
  const ligne = ctx.lignes.get(id)
  const action = (f: () => void) => () => f()
  return (
    <details className="menu-actions menu-bloc">
      <summary aria-label="Actions du bloc" tabIndex={-1}>
        ⋯
      </summary>
      <div role="group" aria-label="Actions du bloc" onClick={fermerMenu}>
        <button type="button" onClick={action(() => ctx.appliquer(decaler(ctx.modele, id, -1)))}>
          Monter <kbd>Alt+↑</kbd>
        </button>
        <button type="button" onClick={action(() => ctx.appliquer(decaler(ctx.modele, id, 1)))}>
          Descendre <kbd>Alt+↓</kbd>
        </button>
        <button
          type="button"
          onClick={action(() => {
            const r = dupliquer(ctx.modele, id)
            ctx.appliquer(r.modele)
            if (r.id) ctx.focaliser(r.id)
          })}
        >
          Dupliquer <kbd>Ctrl+D</kbd>
        </button>
        <button type="button" onClick={action(() => ctx.appliquer(commenter(ctx.modele, id)))}>
          Mettre en commentaire <kbd>Ctrl+/</kbd>
        </button>
        {ligne !== undefined && (
          <button type="button" onClick={action(() => useEtat.getState().basculerPointArret(ligne))}>
            Point d’arrêt <kbd>Ctrl+F8</kbd>
          </button>
        )}
        <button type="button" onClick={action(() => ctx.appliquer(supprimer(ctx.modele, id)))}>
          Supprimer <kbd>Suppr</kbd>
        </button>
      </div>
    </details>
  )
}

function Erreurs({ id }: { id: string }) {
  const ctx = useBlocs()
  const messages = ctx.erreurs.get(id)
  if (!messages) return null
  return (
    <ul className="erreurs-bloc" role="note">
      {messages.map((m, k) => (
        <li key={k}>{m}</li>
      ))}
    </ul>
  )
}

/** Libellé d'un mot-clé du pseudo-code. */
function M({ children }: { children: ReactNode }) {
  return <span className="mot-cle">{children}</span>
}

export function VueBloc({ bloc: b, niveau, insertion }: { bloc: Bloc; niveau: number; insertion: ReactNode }) {
  const ctx = useBlocs()
  const changer = (champ: string) => (v: string) => ctx.appliquer(modifier(ctx.modele, b.id, { [champ]: v }), `${b.id}:${champ}`)
  const erreur = ctx.erreurs.has(b.id)
  const replie = ctx.replies.has(b.id)
  const conteneur = b.genre === 'si' || b.genre === 'pour' || b.genre === 'pourChaque' || b.genre === 'tantQue' || b.genre === 'repeter'
  const commentaire =
    'commentaire' in b && b.commentaire !== undefined ? (
      <span className="commentaire-fin">
        <span aria-hidden="true">//</span>
        <Champ valeur={b.commentaire} modifier={changer('commentaire')} etiquette="Commentaire" sansCompletion />
      </span>
    ) : null

  const replier = conteneur ? (
    <button type="button" className="replier" tabIndex={-1} aria-label="Replier le bloc" aria-expanded={!replie} onClick={() => ctx.basculerRepli(b.id)}>
      {replie ? '▸' : '▾'}
    </button>
  ) : null

  const corps = (cle: CleListe, blocs: Bloc[]) => (replie ? null : <ListeBlocs cle={cle} blocs={blocs} niveau={niveau + 1} />)
  const fin = (texte: string) =>
    replie ? null : (
      <div className="ligne-bloc fin-bloc">
        <span className="poignee" aria-hidden="true" />
        <span className="point-arret" aria-hidden="true" />
        <M>{texte}</M>
      </div>
    )

  let contenu: ReactNode
  switch (b.genre) {
    case 'affectation':
      contenu = (
        <Ligne id={b.id}>
          <Champ valeur={b.cible} modifier={changer('cible')} etiquette="Variable affectée" erreur={erreur} /> <span className="operateur">←</span>{' '}
          <Champ valeur={b.valeur} modifier={changer('valeur')} etiquette="Valeur affectée" erreur={erreur} />
          {commentaire}
        </Ligne>
      )
      break
    case 'lire':
      contenu = (
        <Ligne id={b.id}>
          <M>Lire</M> <Champ valeur={b.cibles} modifier={changer('cibles')} etiquette="Variables lues" erreur={erreur} />
          {commentaire}
        </Ligne>
      )
      break
    case 'afficher':
      contenu = (
        <Ligne id={b.id}>
          <M>Afficher</M> <Champ valeur={b.valeurs} modifier={changer('valeurs')} etiquette="Valeurs affichées" exemple="valeur" erreur={erreur} />{' '}
          <label className="retour" title="Passer à la ligne après l’affichage">
            <input type="checkbox" checked={b.retour} onChange={(e) => ctx.appliquer(modifier(ctx.modele, b.id, { retour: e.target.checked }))} />
            <span aria-hidden="true">↵</span>
            <span className="visuellement-cache">Retour à la ligne</span>
          </label>
          {commentaire}
        </Ligne>
      )
      break
    case 'si':
      contenu = (
        <>
          {b.branches.map((br, k) => (
            <Fragment key={br.id}>
              <Ligne id={k === 0 ? b.id : br.id} menu={k === 0} poignee={k === 0}>
                {k === 0 && replier}
                <M>{k === 0 ? 'Si' : 'Sinon si'}</M>{' '}
                <Champ
                  valeur={br.condition}
                  modifier={(v) => ctx.appliquer(modifier(ctx.modele, br.id, { condition: v }), `${br.id}:condition`)}
                  etiquette={k === 0 ? 'Condition du Si' : 'Condition du Sinon si'}
                  erreur={ctx.erreurs.has(k === 0 ? b.id : br.id)}
                />{' '}
                <M>alors</M>
                {k > 0 && (
                  <button type="button" className="retirer" onClick={() => ctx.appliquer(supprimerBranche(ctx.modele, br.id))}>
                    Retirer ce Sinon si
                  </button>
                )}
              </Ligne>
              {k > 0 && <Erreurs id={br.id} />}
              {corps(br.id, br.corps)}
            </Fragment>
          ))}
          {b.sinon && !replie && (
            <>
              <Ligne id={b.sinon.id} menu={false} poignee={false}>
                <M>Sinon</M>
                <button type="button" className="retirer" onClick={() => ctx.appliquer(supprimerBranche(ctx.modele, b.sinon!.id))}>
                  Retirer le Sinon
                </button>
              </Ligne>
              {corps(b.sinon.id, b.sinon.corps)}
            </>
          )}
          {!replie && (
            <div className="ligne-bloc fin-bloc">
              <span className="poignee" aria-hidden="true" />
              <span className="point-arret" aria-hidden="true" />
              <M>FinSi</M>
              <button
                type="button"
                className="ajout"
                onClick={() => {
                  const r = ajouterSinonSi(ctx.modele, b.id)
                  ctx.appliquer(r.modele)
                  if (r.id) ctx.focaliser(r.id, true)
                }}
              >
                + Sinon si
              </button>
              {!b.sinon && (
                <button type="button" className="ajout" onClick={() => ctx.appliquer(ajouterSinon(ctx.modele, b.id).modele)}>
                  + Sinon
                </button>
              )}
            </div>
          )}
        </>
      )
      break
    case 'pour':
      contenu = (
        <>
          <Ligne id={b.id}>
            {replier}
            <M>Pour</M> <Champ valeur={b.compteur} modifier={changer('compteur')} etiquette="Compteur" erreur={erreur} /> <M>de</M>{' '}
            <Champ valeur={b.debut} modifier={changer('debut')} etiquette="Valeur de début" erreur={erreur} /> <M>à</M>{' '}
            <Champ valeur={b.fin} modifier={changer('fin')} etiquette="Valeur de fin" erreur={erreur} /> <M>pas de</M>{' '}
            <Champ valeur={b.pas} modifier={changer('pas')} etiquette="Pas (facultatif)" exemple="1" erreur={erreur} /> <M>faire</M>
            {commentaire}
          </Ligne>
          {corps(`${b.id}:corps`, b.corps)}
          {fin('FinPour')}
        </>
      )
      break
    case 'pourChaque':
      contenu = (
        <>
          <Ligne id={b.id}>
            {replier}
            <M>Pour chaque</M> <Champ valeur={b.variable} modifier={changer('variable')} etiquette="Variable" erreur={erreur} /> <M>dans</M>{' '}
            <Champ valeur={b.collection} modifier={changer('collection')} etiquette="Liste ou chaîne parcourue" erreur={erreur} /> <M>faire</M>
            {commentaire}
          </Ligne>
          {corps(`${b.id}:corps`, b.corps)}
          {fin('FinPour')}
        </>
      )
      break
    case 'tantQue':
      contenu = (
        <>
          <Ligne id={b.id}>
            {replier}
            <M>TantQue</M> <Champ valeur={b.condition} modifier={changer('condition')} etiquette="Condition du TantQue" erreur={erreur} /> <M>faire</M>
            {commentaire}
          </Ligne>
          {corps(`${b.id}:corps`, b.corps)}
          {fin('FinTantQue')}
        </>
      )
      break
    case 'repeter':
      contenu = (
        <>
          <Ligne id={b.id}>
            {replier}
            <M>Répéter</M>
            {commentaire}
          </Ligne>
          {corps(`${b.id}:corps`, b.corps)}
          {!replie && (
            <div className={`ligne-bloc fin-bloc${ctx.lignes.get(`${b.id}:fin`) === ctx.ligneCourante ? ' bloc-courant' : ''}`}>
              <span className="poignee" aria-hidden="true" />
              <span className="point-arret" aria-hidden="true" />
              <M>Jusqu’à</M> <Champ valeur={b.condition} modifier={changer('condition')} etiquette="Condition de fin du Répéter" erreur={ctx.erreurs.has(`${b.id}:fin`)} />
            </div>
          )}
          <Erreurs id={`${b.id}:fin`} />
        </>
      )
      break
    case 'appel':
      contenu = (
        <Ligne id={b.id}>
          <Champ valeur={b.appel} modifier={changer('appel')} etiquette="Appel de procédure" erreur={erreur} />
          {commentaire}
        </Ligne>
      )
      break
    case 'retourner':
      contenu = (
        <Ligne id={b.id}>
          <M>Retourner</M> <Champ valeur={b.valeur} modifier={changer('valeur')} etiquette="Valeur renvoyée" erreur={erreur} />
          {commentaire}
        </Ligne>
      )
      break
    case 'pause':
      contenu = (
        <Ligne id={b.id}>
          <M>Pause</M>
          {commentaire}
        </Ligne>
      )
      break
    case 'commentaire':
      contenu = (
        <Ligne id={b.id}>
          <span className="commentaire-bloc">
            <span aria-hidden="true">//</span>
            <Champ valeur={b.texte} modifier={changer('texte')} etiquette="Commentaire" sansCompletion />
          </span>
        </Ligne>
      )
      break
    case 'vide':
      contenu = (
        <Ligne id={b.id}>
          <span className="ligne-vide">ligne vide</span>
        </Ligne>
      )
      break
  }

  const ligne = ctx.lignes.get(b.id)
  return (
    <li
      data-bloc={b.id}
      data-ligne={ligne}
      data-conteneur={conteneur || undefined}
      data-replie={replie || undefined}
      tabIndex={-1}
      className={`bloc bloc-${b.genre}${erreur ? ' avec-erreur' : ''}`}
    >
      {insertion}
      {contenu}
      <Erreurs id={b.id} />
      {replie && <p className="replie">… bloc replié</p>}
    </li>
  )
}

// ---------------------------------------------------------------- Déclarations, corps et sous-programmes

function VueLigneVariables({ ligne: l }: { ligne: LigneVariables }) {
  const ctx = useBlocs()
  const changer = (champ: string) => (v: string) => ctx.appliquer(modifierLigneVariables(ctx.modele, l.id, { [champ]: v }), `${l.id}:${champ}`)
  const erreur = ctx.erreurs.has(l.id)
  return (
    <li data-bloc={l.id} tabIndex={-1} className={`bloc bloc-declaration${erreur ? ' avec-erreur' : ''}`}>
      <div className="ligne-bloc">
        <span className="poignee" aria-hidden="true" />
        <span className="point-arret" aria-hidden="true" />
        <span className="contenu-bloc">
          {l.genre === 'declaration' ? (
            <>
              <Champ valeur={l.noms} modifier={changer('noms')} etiquette="Noms des variables" erreur={erreur} sansCompletion /> <span className="operateur">:</span>{' '}
              <Champ valeur={l.type} modifier={changer('type')} etiquette="Type" erreur={erreur} sansCompletion />
            </>
          ) : l.genre === 'commentaire' ? (
            <span className="commentaire-bloc">
              <span aria-hidden="true">//</span>
              <Champ valeur={l.texte} modifier={changer('texte')} etiquette="Commentaire" sansCompletion />
            </span>
          ) : (
            <span className="ligne-vide">ligne vide</span>
          )}
        </span>
        <button type="button" className="retirer" aria-label="Supprimer cette ligne" title="Supprimer cette ligne" onClick={() => ctx.appliquer(supprimerLigneVariables(ctx.modele, l.id))}>
          ×
        </button>
      </div>
      <Erreurs id={l.id} />
    </li>
  )
}

export function VueCorps({ corps, fermeture }: { corps: CorpsBlocs; fermeture: string }) {
  const ctx = useBlocs()
  const declarer = () => {
    const r = ajouterDeclaration(ctx.modele, corps.id)
    ctx.appliquer(r.modele)
    if (r.id) ctx.focaliser(r.id, true)
  }
  return (
    <>
      {corps.variables && (
        <>
          <div className="ligne-section">
            <M>Variables</M>
          </div>
          <ul className="liste-blocs">
            {corps.variables.map((l) => (
              <VueLigneVariables key={l.id} ligne={l} />
            ))}
          </ul>
        </>
      )}
      <div className="ligne-section">
        <button type="button" className="ajout" onClick={declarer}>
          + Déclarer une variable
        </button>
      </div>
      <div className="ligne-section">
        <M>Début</M>
      </div>
      <ListeBlocs cle={corps.id} blocs={corps.instructions} niveau={2} />
      <div className="ligne-section">
        <M>{fermeture}</M>
      </div>
    </>
  )
}

export function VueSousProgramme({ sp }: { sp: SousProgrammeBlocs }) {
  const ctx = useBlocs()
  const changer = (champ: 'nom' | 'parametres' | 'typeRetour') => (v: string) =>
    ctx.appliquer(modifierSousProgramme(ctx.modele, sp.id, { [champ]: v }), `${sp.id}:${champ}`)
  const erreur = ctx.erreurs.has(sp.id)
  return (
    <section className="sous-programme" aria-label={`${sp.type === 'fonction' ? 'Fonction' : 'Procédure'} ${sp.nom}`}>
      <div className={`ligne-section entete-sous-programme${erreur ? ' avec-erreur' : ''}`} data-bloc={sp.id} tabIndex={-1}>
        <M>{sp.type === 'fonction' ? 'Fonction' : 'Procédure'}</M> <Champ valeur={sp.nom} modifier={changer('nom')} etiquette="Nom" erreur={erreur} sansCompletion />
        <span className="operateur">(</span>
        <Champ valeur={sp.parametres} modifier={changer('parametres')} etiquette="Paramètres" exemple="x : entier" erreur={erreur} sansCompletion />
        <span className="operateur">)</span>
        {sp.type === 'fonction' && (
          <>
            {' '}
            <span className="operateur">:</span> <Champ valeur={sp.typeRetour} modifier={changer('typeRetour')} etiquette="Type renvoyé" erreur={erreur} sansCompletion />
          </>
        )}
        <button type="button" className="retirer" onClick={() => ctx.appliquer(supprimerSousProgramme(ctx.modele, sp.id))}>
          Supprimer
        </button>
      </div>
      <Erreurs id={sp.id} />
      <VueCorps corps={sp.corps} fermeture={sp.type === 'fonction' ? 'FinFonction' : 'FinProcédure'} />
    </section>
  )
}
