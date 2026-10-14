<?xml version="1.0" encoding="UTF-8"?>
<!-- Format ancien : ni extension, ni F2, ni paramètres, ni bloc des fonctions. -->
<Algo>
    <description texte="Table de multiplication"/>
    <fonction fctcode="" fctetat="inactif"/>
    <repere repcode="-10#10#-10#10#2#2" repetat="inactif"/>
    <item code="100#declarationsvariables" algoitem="VARIABLES">
        <item code="1#NOMBRE#t" algoitem="t EST_DU_TYPE NOMBRE"/>
        <item code="1#NOMBRE#c" algoitem="c EST_DU_TYPE NOMBRE"/>
    </item>
    <item code="101#debutalgo" algoitem="DEBUT_ALGORITHME">
        <item code="2#t#pasliste" algoitem="LIRE t"/>
        <item code="12#c#1#10" algoitem="POUR c ALLANT_DE 1 A 10">
            <item code="13#debutpour" algoitem="DEBUT_POUR"/>
            <item code="20#c*t" algoitem="AFFICHERCALCUL c*t"/>
            <item code="4# " algoitem="AFFICHER &quot; &quot;"/>
            <item code="14#finpour" algoitem="FIN_POUR"/>
        </item>
        <item code="4##1" algoitem="AFFICHER &quot;&quot;"/>
        <item code="6#t%2==0" algoitem="SI (t%2==0) ALORS">
            <item code="7#debutsi" algoitem="DEBUT_SI"/>
            <item code="4#pair#1" algoitem="AFFICHER &quot;pair&quot;"/>
            <item code="8#finsi" algoitem="FIN_SI"/>
        </item>
        <item code="9#sinon" algoitem="SINON">
            <item code="10#debutsinon" algoitem="DEBUT_SINON"/>
            <item code="4#impair#1" algoitem="AFFICHER &quot;impair&quot;"/>
            <item code="11#finsinon" algoitem="FIN_SINON"/>
        </item>
    </item>
    <item code="102#finalgo" algoitem="FIN_ALGORITHME"/>
    <inconnu valeur="ignoré"/>
</Algo>
