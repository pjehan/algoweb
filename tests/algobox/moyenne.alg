<?xml version="1.0" encoding="UTF-8"?>
<Algo>
    <description texte="Moyenne de n notes, avec mention.&#xa;Fichier écrit pour les tests d'AlgoWeb." courant="FIN_ALGORITHME"/>
    <extension extnom="inactif"/>
    <fonction fctetat="inactif" fctcode=""/>
    <F2 F2etat="inactif" F2para="" F2defaut="" F2lignes=""/>
    <repere repetat="inactif" repcode="-10#10#-10#10#2#2"/>
    <param arrondiAuto="vrai" maxBoucle="500000" totalBoucles="5000000" totalAffichages="1000" epaisseurLigne="2" epaisseurPoint="2" nbDecimales="8"/>
    <item algoitem="FONCTIONS_UTILISEES" code="200#declarationfonctions"/>
    <item algoitem="VARIABLES" code="100#declarationsvariables">
        <item algoitem="n EST_DU_TYPE NOMBRE" code="1#NOMBRE#n"/>
        <item algoitem="i EST_DU_TYPE NOMBRE" code="1#NOMBRE#i"/>
        <item algoitem="note EST_DU_TYPE NOMBRE" code="1#NOMBRE#note"/>
        <item algoitem="total EST_DU_TYPE NOMBRE" code="1#NOMBRE#total"/>
        <item algoitem="moyenne EST_DU_TYPE NOMBRE" code="1#NOMBRE#moyenne"/>
        <item algoitem="compte EST_DU_TYPE NOMBRE" code="1#NOMBRE#compte"/>
        <item algoitem="prenom EST_DU_TYPE CHAINE" code="1#CHAINE#prenom"/>
    </item>
    <item algoitem="DEBUT_ALGORITHME" code="101#debutalgo">
        <item algoitem="//Saisie du prénom et du nombre de notes" code="19#Saisie du prénom et du nombre de notes"/>
        <item algoitem="LIRE prenom" code="2#prenom#pasliste"/>
        <item algoitem="LIRE n" code="2#n#pasliste"/>
        <item algoitem="total PREND_LA_VALEUR 0" code="5#total#0#pasliste"/>
        <item algoitem="compte PREND_LA_VALEUR 0" code="5#compte#0#pasliste"/>
        <item algoitem="" code="103#vide"/>
        <item algoitem="POUR i ALLANT_DE 1 A n" code="12#i#1#n">
            <item algoitem="DEBUT_POUR" code="13#debutpour"/>
            <item algoitem="LIRE note" code="2#note#pasliste"/>
            <item algoitem="total PREND_LA_VALEUR total+note" code="5#total#total+note#pasliste"/>
            <item algoitem="SI (note&gt;=10) ALORS" code="6#note&gt;=10">
                <item algoitem="DEBUT_SI" code="7#debutsi"/>
                <item algoitem="compte PREND_LA_VALEUR compte+1" code="5#compte#compte+1#pasliste"/>
                <item algoitem="FIN_SI" code="8#finsi"/>
            </item>
            <item algoitem="FIN_POUR" code="14#finpour"/>
        </item>
        <item algoitem="moyenne PREND_LA_VALEUR total/n" code="5#moyenne#total/n#pasliste"/>
        <item algoitem="AFFICHER &quot;Bonjour &quot;" code="4#Bonjour #0"/>
        <item algoitem="AFFICHER prenom" code="3#prenom#1#pasliste"/>
        <item algoitem="AFFICHER &quot;Moyenne : &quot;" code="4#Moyenne : #0"/>
        <item algoitem="AFFICHER moyenne" code="3#moyenne#1#pasliste"/>
        <item algoitem="SI (moyenne&gt;=16) ALORS" code="6#moyenne&gt;=16">
            <item algoitem="DEBUT_SI" code="7#debutsi"/>
            <item algoitem="AFFICHER &quot;Très bien&quot;" code="4#Très bien#1"/>
            <item algoitem="FIN_SI" code="8#finsi"/>
            <item algoitem="SINON" code="9#sinon">
                <item algoitem="DEBUT_SINON" code="10#debutsinon"/>
                <item algoitem="SI (moyenne&gt;=10 ET compte&gt;n/2) ALORS" code="6#moyenne&gt;=10 ET compte&gt;n/2">
                    <item algoitem="DEBUT_SI" code="7#debutsi"/>
                    <item algoitem="AFFICHER &quot;Admis&quot;" code="4#Admis#1"/>
                    <item algoitem="FIN_SI" code="8#finsi"/>
                    <item algoitem="SINON" code="9#sinon">
                        <item algoitem="DEBUT_SINON" code="10#debutsinon"/>
                        <item algoitem="AFFICHER &quot;Ajourné&quot;" code="4#Ajourné#1"/>
                        <item algoitem="FIN_SINON" code="11#finsinon"/>
                    </item>
                </item>
                <item algoitem="FIN_SINON" code="11#finsinon"/>
            </item>
        </item>
        <item algoitem="AFFICHERCALCUL compte*100/n" code="20#compte*100/n#0"/>
        <item algoitem="AFFICHER &quot; % de notes au-dessus de 10&quot;" code="4# % de notes au-dessus de 10#1"/>
        <item algoitem="TANT_QUE (n&gt;0) FAIRE" code="15#n&gt;0">
            <item algoitem="DEBUT_TANT_QUE" code="16#debuttantque"/>
            <item algoitem="AFFICHER n" code="3#n#0#pasliste"/>
            <item algoitem="n PREND_LA_VALEUR n-1" code="5#n#n-1#pasliste"/>
            <item algoitem="FIN_TANT_QUE" code="17#fintantque"/>
        </item>
        <item algoitem="PAUSE" code="18#pause"/>
        <item algoitem="AFFICHER &quot;&quot;" code="4##1"/>
        <item algoitem="AFFICHER &quot;Fin&quot;" code="4#Fin#1"/>
    </item>
    <item algoitem="FIN_ALGORITHME" code="102#finalgo"/>
</Algo>
