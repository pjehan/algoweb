<?xml version="1.0" encoding="UTF-8"?>
<Algo>
    <description texte="Conversion des expressions JavaScript d'AlgoBox." courant=""/>
    <item algoitem="FONCTIONS_UTILISEES" code="200#declarationfonctions"/>
    <item algoitem="VARIABLES" code="100#declarationsvariables">
        <item algoitem="a EST_DU_TYPE NOMBRE" code="1#NOMBRE#a"/>
        <item algoitem="b EST_DU_TYPE NOMBRE" code="1#NOMBRE#b"/>
        <item algoitem="r EST_DU_TYPE NOMBRE" code="1#NOMBRE#r"/>
        <item algoitem="max EST_DU_TYPE NOMBRE" code="1#NOMBRE#max"/>
        <item algoitem="mot EST_DU_TYPE CHAINE" code="1#CHAINE#mot"/>
        <item algoitem="T EST_DU_TYPE LISTE" code="1#LISTE#T"/>
        <item algoitem="k EST_DU_TYPE NOMBRE" code="1#NOMBRE#k"/>
    </item>
    <item algoitem="DEBUT_ALGORITHME" code="101#debutalgo">
        <item algoitem="a PREND_LA_VALEUR ALGOBOX_ALEA_ENT(1,6)" code="5#a#ALGOBOX_ALEA_ENT(1,6)#pasliste"/>
        <item algoitem="b PREND_LA_VALEUR pow(a,2)%7" code="5#b#pow(a,2)%7#pasliste"/>
        <item algoitem="r PREND_LA_VALEUR Math.sqrt(a)+SQRT(b)*Math.PI" code="5#r#Math.sqrt(a)+SQRT(b)*Math.PI#pasliste"/>
        <item algoitem="r PREND_LA_VALEUR ALGOBOX_ARRONDIR(r,2)" code="5#r#ALGOBOX_ARRONDIR(r,2)#pasliste"/>
        <item algoitem="max PREND_LA_VALEUR floor(r)+round(r/3)" code="5#max#floor(r)+round(r/3)#pasliste"/>
        <item algoitem="mot PREND_LA_VALEUR &quot;Valeur : &quot;+a" code="5#mot#&quot;Valeur : &quot;+a#pasliste"/>
        <item algoitem="mot PREND_LA_VALEUR mot.substr(2,3)+mot.charAt(0)+String.fromCharCode(65)" code="5#mot#mot.substr(2,3)+mot.charAt(0)+String.fromCharCode(65)#pasliste"/>
        <item algoitem="AFFICHERCALCUL mot.length+mot.charCodeAt(1)" code="20#mot.length+mot.charCodeAt(1)#1"/>
        <item algoitem="AFFICHERCALCUL a.toString()+b" code="20#a.toString()+b#1"/>
        <item algoitem="SI (a==b || !(a!=1) &amp;&amp; b&lt;=3 OU a&gt;=b) ALORS" code="6#a==b || !(a!=1) &amp;&amp; b&lt;=3 OU a&gt;=b">
            <item algoitem="DEBUT_SI" code="7#debutsi"/>
            <item algoitem="a PREND_LA_VALEUR -(a+1)*(b-2)/-3" code="5#a#-(a+1)*(b-2)/-3#pasliste"/>
            <item algoitem="FIN_SI" code="8#finsi"/>
        </item>
        <item algoitem="T[0] PREND_LA_VALEUR 4:1:9" code="5#T#4:1:9#0"/>
        <item algoitem="AFFICHERCALCUL ALGOBOX_SOMME(T,0,2)+ALGOBOX_MOYENNE(T,0,k)" code="20#ALGOBOX_SOMME(T,0,2)+ALGOBOX_MOYENNE(T,0,k)#1"/>
        <item algoitem="AFFICHERCALCUL ALGOBOX_ECART_TYPE(T,0,2)" code="20#ALGOBOX_ECART_TYPE(T,0,2)#1"/>
        <item algoitem="AFFICHERCALCUL a^b" code="20#a^b#1"/>
        <item algoitem="AFFICHERCALCUL mot.toUpperCase()" code="20#mot.toUpperCase()#1"/>
        <item algoitem="AFFICHERCALCUL (a+" code="20#(a+#1"/>
        <item algoitem="POUR k ALLANT_DE 1 A a/2" code="12#k#1#a/2">
            <item algoitem="DEBUT_POUR" code="13#debutpour"/>
            <item algoitem="a PREND_LA_VALEUR a-1" code="5#a#a-1#pasliste"/>
            <item algoitem="FIN_POUR" code="14#finpour"/>
        </item>
        <item algoitem="TRUC" code="99#truc"/>
    </item>
    <item algoitem="FIN_ALGORITHME" code="102#finalgo"/>
</Algo>
