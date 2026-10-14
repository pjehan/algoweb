<?xml version="1.0" encoding="UTF-8"?>
<Algo>
    <description texte="" courant="DEBUT_ALGORITHME"/>
    <extension extnom="outils.js"/>
    <fonction fctetat="actif" fctcode="x*x-2*x+1"/>
    <F2 F2etat="actif" F2para="a,b" F2defaut="a+b" F2lignes="a&lt;0@-a#b==0@a/2#"/>
    <repere repetat="actif" repcode="-5#5#-5#5#1#1"/>
    <param arrondiAuto="vrai" maxBoucle="500000" totalBoucles="5000000" totalAffichages="1000" epaisseurLigne="2" epaisseurPoint="2" nbDecimales="8"/>
    <item algoitem="FONCTIONS_UTILISEES" code="200#declarationfonctions">
        <item algoitem="FONCTION carre(k)" code="201#carre#k">
            <item algoitem="VARIABLES_FONCTION" code="202#declarationsvariablesfonction"/>
            <item algoitem="DEBUT_FONCTION" code="203#debutfonction"/>
            <item algoitem="RENVOYER k*k" code="205#k*k"/>
            <item algoitem="FIN_FONCTION" code="204#finfonction"/>
        </item>
        <item algoitem="" code="103#vide"/>
        <item algoitem="//Somme des entiers de 1 à m" code="19#Somme des entiers de 1 à m"/>
        <item algoitem="FONCTION somme(m)" code="201#somme#m">
            <item algoitem="VARIABLES_FONCTION" code="202#declarationsvariablesfonction">
                <item algoitem="s EST_DU_TYPE NOMBRE" code="1#NOMBRE#s"/>
                <item algoitem="j EST_DU_TYPE NOMBRE" code="1#NOMBRE#j"/>
            </item>
            <item algoitem="DEBUT_FONCTION" code="203#debutfonction"/>
            <item algoitem="s PREND_LA_VALEUR 0" code="5#s#0#pasliste"/>
            <item algoitem="POUR j ALLANT_DE 1 A m" code="12#j#1#m">
                <item algoitem="DEBUT_POUR" code="13#debutpour"/>
                <item algoitem="s PREND_LA_VALEUR s+j" code="5#s#s+j#pasliste"/>
                <item algoitem="FIN_POUR" code="14#finpour"/>
            </item>
            <item algoitem="RENVOYER s" code="205#s"/>
            <item algoitem="FIN_FONCTION" code="204#finfonction"/>
        </item>
        <item algoitem="FONCTION saluer(qui)" code="201#saluer#qui">
            <item algoitem="VARIABLES_FONCTION" code="202#declarationsvariablesfonction">
                <item algoitem="fin EST_DU_TYPE CHAINE" code="1#CHAINE#fin"/>
            </item>
            <item algoitem="DEBUT_FONCTION" code="203#debutfonction"/>
            <item algoitem="fin PREND_LA_VALEUR &quot; !&quot;" code="5#fin#&quot; !&quot;#pasliste"/>
            <item algoitem="AFFICHERCALCUL &quot;Bonjour &quot;+qui+fin" code="20#&quot;Bonjour &quot;+qui+fin#1"/>
            <item algoitem="FIN_FONCTION" code="204#finfonction"/>
        </item>
        <item algoitem="FONCTION remplir(T,taille)" code="201#remplir#T,taille">
            <item algoitem="VARIABLES_FONCTION" code="202#declarationsvariablesfonction">
                <item algoitem="r EST_DU_TYPE NOMBRE" code="1#NOMBRE#r"/>
            </item>
            <item algoitem="DEBUT_FONCTION" code="203#debutfonction"/>
            <item algoitem="POUR r ALLANT_DE 0 A taille-1" code="12#r#0#taille-1">
                <item algoitem="DEBUT_POUR" code="13#debutpour"/>
                <item algoitem="T[r] PREND_LA_VALEUR r/2" code="5#T#r/2#r"/>
                <item algoitem="FIN_POUR" code="14#finpour"/>
            </item>
            <item algoitem="FIN_FONCTION" code="204#finfonction"/>
        </item>
        <item algoitem="FONCTION afficherTotal()" code="201#afficherTotal# ">
            <item algoitem="VARIABLES_FONCTION" code="202#declarationsvariablesfonction"/>
            <item algoitem="DEBUT_FONCTION" code="203#debutfonction"/>
            <item algoitem="AFFICHER total" code="3#total#1#pasliste"/>
            <item algoitem="FIN_FONCTION" code="204#finfonction"/>
        </item>
    </item>
    <item algoitem="VARIABLES" code="100#declarationsvariables">
        <item algoitem="total EST_DU_TYPE NOMBRE" code="1#NOMBRE#total"/>
        <item algoitem="Mes EST_DU_TYPE LISTE" code="1#LISTE#Mes"/>
        <item algoitem="liste EST_DU_TYPE LISTE" code="1#LISTE#liste"/>
        <item algoitem="y EST_DU_TYPE NOMBRE" code="1#NOMBRE#y"/>
    </item>
    <item algoitem="DEBUT_ALGORITHME" code="101#debutalgo">
        <item algoitem="total PREND_LA_VALEUR somme(10)" code="5#total#somme(10)#pasliste"/>
        <item algoitem="AFFICHERCALCUL carre(total)" code="20#carre(total)#1"/>
        <item algoitem="APPELER_FONCTION saluer(&quot;Ada&quot;)" code="206#saluer(&quot;Ada&quot;)"/>
        <item algoitem="APPELER_FONCTION remplir(Mes,4)" code="206#remplir(Mes,4)"/>
        <item algoitem="liste[1] PREND_LA_VALEUR 3:5:8" code="5#liste#3:5:8#1"/>
        <item algoitem="LIRE liste[4]" code="2#liste#4"/>
        <item algoitem="AFFICHER liste[2]" code="3#liste#1#2"/>
        <item algoitem="y PREND_LA_VALEUR F1(2)+F2(3,0)" code="5#y#F1(2)+F2(3,0)#pasliste"/>
        <item algoitem="APPELER_FONCTION afficherTotal()" code="206#afficherTotal()"/>
        <item algoitem="TRACER_POINT (1,y)" code="50#1#y#Rouge"/>
        <item algoitem="TRACER_SEGMENT (0,0)-&gt;(1,y)" code="51#0#0#1#y#Bleu"/>
        <item algoitem="EFFACER_GRAPHIQUE" code="52#effacer"/>
    </item>
    <item algoitem="FIN_ALGORITHME" code="102#finalgo"/>
</Algo>
