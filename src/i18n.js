import { useEffect } from "react";

const EN_REPLACEMENTS = [
  ["Drei kleine Felder in einer Reihe gewinnen.", "Win three small boards in a row."],
  ["✕ entfernt einen eigenen Stein", "✕ removes one of their stones"],
  ["Partien bleiben beim Wechsel ins Menü erhalten — „↻\" oben setzt sie zurück. Jedes Spiel hat einen Computergegner: Schalter MENSCH/BOT direkt im Spiel. Regeln unter dem „i\" oben rechts.", "Games remain active when you return to the menu — “↻” resets the current game. Every game has a computer opponent: use the HUMAN/BOT switch inside the game. Rules are available under the “i” button."],
  ["Landet der letzte Stein in einer leeren eigenen Mulde, nimmst du ihn und alle Steine der gegenüberliegenden gegnerischen Mulde in deinen Speicher.", "If the last stone lands in an empty pit on your side, capture it and all stones in the opposite enemy pit into your store."],
  ["Tippe eine deiner Mulden an. Alle Steine daraus werden einzeln gegen den Uhrzeigersinn in die folgenden Mulden verteilt — dein Speicher wird mitgefüllt, der gegnerische übersprungen.", "Tap one of your pits. Its stones are distributed counterclockwise, one by one — include your store and skip your opponent’s store."],
  ["Wer zuerst alle eigenen Steine verbunden hat, gewinnt. Verbindet dein Zug (etwa durch Schlagen) nur den Gegner, gewinnt dieser.", "The first player to connect all their stones wins. If your move connects only the opponent, the opponent wins."],
  ["Setze so, dass zwischen dem neuen Stein und einem bestehenden eigenen Stein eine ununterbrochene Reihe gegnerischer Steine eingeschlossen wird — diese werden umgedreht. Mögliche Felder sind markiert.", "Place a stone so that an unbroken line of enemy stones is trapped between it and one of your stones — those stones are flipped. Valid spaces are highlighted."],
  ["Nach einem Schlag darf derselbe Stein weiterschlagen — nicht zweimal dieselbe Richtung, kein Punkt doppelt. Fortsetzen ist freiwillig.", "After a capture, the same stone may continue capturing — never twice in the same direction and never through the same point. Continuing is optional."],
  ["Über die Modus-Buttons waagerecht oder senkrecht platzieren. Jeder hat zehn Stück — sie bremsen den Gegner, dürfen ihm aber nie den letzten Weg komplett versperren.", "Use the mode buttons to place walls horizontally or vertically. Each player has ten walls — they slow the opponent but may never block every remaining path."],
  ["Entweder einen neuen Stein aus dem Vorrat setzen oder einen eigenen obenliegenden Stein vom Brett umsetzen. Vorsicht: Hebt man einen Stein hoch, kann darunter eine gegnerische Reihe sichtbar werden.", "Either place a new piece from your reserve or move one of your visible pieces already on the board. Be careful: lifting a piece may reveal an opponent’s winning line."],
  ["Erst einen Stein auf ein freies Feld setzen, dann einen der vier Quadranten um 90° drehen (↺/↻). Die Drehung gehört zwingend zum Zug dazu.", "First place a stone on an empty space, then rotate one of the four quadrants by 90° (↺/↻). The rotation is mandatory."],
  ["Wer eine Reihe, Spalte oder Diagonale aus vier Stücken vollendet, die", "Whoever completes a row, column, or diagonal of four pieces that"],
  ["Du hast zwei Bewegungskarten; das Raster auf der Karte zeigt die möglichen Sprünge. Wähle Karte, dann Figur, dann Ziel.", "You have two move cards; each card’s grid shows the available jumps. Select a card, then a piece, then a destination."],
  ["Die genutzte Karte wandert zur Seite, die dort wartende neutrale Karte kommt in deine Hand — die Karten rotieren also ständig.", "The used card moves to the side and the neutral card waiting there enters your hand — the cards rotate continuously."],
  ["Ein Stein zieht waagerecht, senkrecht oder diagonal. Die Weite ist genau die Anzahl aller Steine (beide Farben) auf dieser Linie.", "A stone moves horizontally, vertically, or diagonally. Its distance equals the total number of stones of both colors on that line."],
  ["Klemme einen gegnerischen Stein zwischen zwei eigene (oder einen eigenen und Thron/Ecke) — er wird entfernt.", "Trap an enemy stone between two of your pieces, or between one of your pieces and the throne/corner, to remove it."],
  ["Alle ziehen waagerecht/senkrecht beliebig weit, nicht über Figuren. Thron (Mitte) und Ecken darf nur der König betreten.", "All pieces move any distance horizontally or vertically without jumping. Only the king may enter the throne and corner spaces."],
  ["Jeder hat je zwei kleine, mittlere und große. Ein größerer Stein darf einen kleineren verschlucken — auch einen eigenen, auch auf dem Brett.", "Each player has two small, medium, and large pieces. A larger piece may cover a smaller one — including your own pieces and pieces already on the board."],
  ["Über einen benachbarten Stein (egal welche Farbe) auf das leere Feld dahinter — Sprünge dürfen in einem Zug verkettet werden. Nichts wird geschlagen.", "Jump over an adjacent stone of either color onto the empty space beyond it — multiple jumps may be chained in one turn. No pieces are captured."],
  ["Über eigene Steine darfst du springen, nicht über gegnerische. Auf dem Zielfeld darf kein eigener Stein stehen — ein gegnerischer wird geschlagen.", "You may jump over your own pieces, but not enemy pieces. The destination may not contain your own piece; an enemy piece there is captured."],
  ["Ziehe einen eigenen Stein auf ein direkt benachbartes Feld (waagerecht/senkrecht), das von einem gegnerischen Stein besetzt ist — und ersetze ihn.", "Move one of your stones onto an orthogonally adjacent enemy stone and replace it."],
  ["Springe waagerecht/senkrecht über einen gegnerischen Stein auf das leere Feld dahinter — der übersprungene Stein wird entfernt.", "Jump horizontally or vertically over an enemy stone onto the empty space beyond it — remove the jumped stone."],
  ["Direkt nach dem ersten Zug darf ○ diesen übernehmen statt selbst zu setzen — das gleicht den Anzugsvorteil aus.", "Immediately after the first move, ○ may take it over instead of placing a stone — this balances the first-player advantage."],
  ["Weil der erste Zug stark ist, darf ○ direkt nach dem allerersten Stein die Seiten tauschen statt selbst zu setzen.", "Because the opening move is strong, ○ may swap sides immediately after the first stone instead of making a move."],
  ["Auch die Drehung kann dem Gegner fünf in einer Reihe bescheren. Entsteht für beide gleichzeitig eine Reihe, ist es unentschieden.", "The rotation can also give the opponent five in a row. If both players form a line simultaneously, the game is a draw."],
  ["Von ihrem neuen Feld schießt sie einen Pfeil — ebenfalls wie eine Dame. Das getroffene Feld ist dauerhaft blockiert.", "From her new space, the Amazon shoots an arrow like a chess queen. The target space remains permanently blocked."],
  ["Bewege eine deiner vier Amazonen wie eine Schachdame (beliebig weit, 8 Richtungen, nicht über Figuren).", "Move one of your four Amazons like a chess queen: any distance in eight directions, without jumping pieces."],
  ["Pro Runde entweder ein Feld weit ziehen (waagerecht/senkrecht) oder eine Wand setzen. Stehen die Figuren direkt voreinander, darf übersprungen werden.", "Each turn, either move one space horizontally or vertically, or place a wall. If the pawns face each other directly, you may jump over."],
  ["Wer keinen gültigen Zug hat, setzt aus. Sind beide blockiert oder ist das Brett voll, endet das Spiel.", "A player with no valid move passes. The game ends when both players are blocked or the board is full."],
  ["Verteidiger gewinnen, wenn der König eine Ecke erreicht. Angreifer gewinnen, wenn sie den König fangen.", "The defenders win when the king reaches a corner. The attackers win when they capture the king."],
  ["Wird nur geschlagen, wenn er von allen vier Seiten (Angreifer oder Thron) umzingelt ist.", "The king is captured only when surrounded on all four sides by attackers or the throne."],
  ["Wer zuerst vier in einer Reihe hat, gewinnt. Volles Brett ohne Reihe ist unentschieden.", "The first player with four in a row wins. A full board without a line is a draw."],
  ["Wer zuerst fünf in einer Reihe hat, gewinnt. Volles Brett ohne Reihe ist unentschieden.", "The first player with five in a row wins. A full board without a line is a draw."],
  ["Wer keinen Sprung mehr machen kann, verliert.", "The first player unable to jump loses."],
  ["Wer am Zug ist und keinen Stein mehr neben einem Gegner hat, verliert.", "The player who has no stone adjacent to an opponent on their turn loses."],
  ["Pfeile und Amazonen sperren das Brett zu. Wer keine Amazone mehr bewegen kann, verliert.", "Arrows and Amazons gradually block the board. The first player unable to move an Amazon loses."],
  ["Sobald eine Reihe leer ist, wandern die übrigen Steine der anderen Reihe in deren Speicher. Mehrheit gewinnt.", "When one row is empty, all remaining stones in the other row move to that player’s store. The majority wins."],
  ["Landet der letzte Stein in deinem Speicher, bist du sofort wieder dran.", "If the last stone lands in your store, take another turn immediately."],
  ["Hast du ein Kästchen geschlossen, bist du sofort wieder dran. Sonst wechselt der Zug.", "If you complete a box, take another turn immediately. Otherwise the turn changes."],
  ["Wer die vierte Kante eines Kästchens zieht und es damit schließt, bekommt es in seiner Farbe.", "Whoever draws the fourth edge of a box claims it in their color."],
  ["Wenn alle Kanten gezogen sind, gewinnt die Mehrheit der Kästchen.", "When every edge has been drawn, the player with the most boxes wins."],
  ["Kannst du schlagen, musst du. Bietet ein Zug beide Richtungen, darfst du wählen.", "If you can capture, you must. If a move offers both directions, you may choose."],
  ["In gerader Linie darfst du in einem Zug mehrere Steine hintereinander schlagen. Tippe das gewünschte Endfeld an.", "You may capture several consecutive stones in a straight line during one turn. Tap the desired destination."],
  ["Zuerst entfernt ✕ einen eigenen Stein, dann ○ einen daran angrenzenden eigenen Stein.", "First ✕ removes one of their stones, then ○ removes one of their own stones adjacent to it."],
  ["Nur diagonal vorwärts. Geradeaus kann nicht geschlagen werden — ein Stein direkt davor blockiert.", "Capture only diagonally forward. You cannot capture straight ahead, and a piece directly ahead blocks movement."],
  ["Ein Stein zieht ein Feld geradeaus oder diagonal vorwärts, wenn das Ziel leer ist.", "A piece moves one empty space straight or diagonally forward."],
  ["Jeder hat einen Meister (mit Ring) und vier Schüler. Der Meister startet auf dem eigenen Tempelfeld.", "Each player has one master with a ring and four students. The master starts on its own temple space."],
  ["Karte + Figur wählen, dann ziehen. Schlage den Meister oder erreiche den gegnerischen Tempel.", "Select a card and piece, then move. Capture the master or reach the opponent’s temple."],
  ["Schlage den gegnerischen Meister oder ziehe deinen Meister auf das gegnerische Tempelfeld.", "Capture the opposing master or move your master onto the opponent’s temple space."],
  ["Bringe alle deine Steine zu einer einzigen zusammenhängenden Gruppe — waagerecht, senkrecht oder diagonal benachbart zählt.", "Bring all your stones into one connected group; horizontal, vertical, and diagonal adjacency all count."],
  ["Fünf eigene Steine in einer Reihe — waagerecht, senkrecht oder diagonal, auch über Quadrantengrenzen hinweg.", "Form a row of five of your stones horizontally, vertically, or diagonally, including across quadrant boundaries."],
  ["Fünf eigene Steine in einer ununterbrochenen Reihe — waagerecht, senkrecht oder diagonal.", "Form an unbroken row of five of your stones horizontally, vertically, or diagonally."],
  ["Vier eigene Steine in einer Reihe — waagerecht, senkrecht oder diagonal.", "Form a row of four of your stones horizontally, vertically, or diagonally."],
  ["Drei eigene Steine in einer Reihe — waagerecht, senkrecht oder diagonal.", "Form a row of three of your pieces horizontally, vertically, or diagonally."],
  ["Gewinne drei der neun kleinen Felder in einer Reihe.", "Win three of the nine small boards in a row."],
  ["Dein Zug bestimmt das nächste Feld — wo du in einem kleinen Feld spielst, dorthin (großes Feld) muss der Gegner.", "Your move determines the next board: the small space you choose sends your opponent to the matching large board."],
  ["Ist das vorgegebene Feld schon entschieden oder voll, darf der Gegner frei wählen.", "If the required board is already decided or full, the opponent may choose any board."],
  ["Dein Zug schickt den Gegner ins gleichnamige Feld.", "Your move sends the opponent to the corresponding board."],
  ["Ordnung beginnt. Wähle oben dein Symbol, dann tippe ein Feld.", "Order starts. Select your symbol above, then tap a space."],
  ["Beide Spieler setzen", "Both players place"],
  ["— frei wählbar pro Zug. Die Symbole gehören niemandem.", "— freely chosen each turn. The symbols belong to neither player."],
  ["Ordnung will fünf in Reihe — Chaos will es verhindern.", "Order wants five in a row; Chaos tries to prevent it."],
  ["gewinnt, wenn das Brett voll ist, ohne dass das passiert.", "wins if the board fills without that happening."],
  ["gewinnt, sobald", "wins as soon as"],
  ["fünf gleiche Symbole", "five matching symbols"],
  ["in einer Reihe stehen (egal wer sie gesetzt hat).", "form a row, regardless of who placed them."],
  ["Nicht du wählst, was du setzt — dein", "You do not choose what you place — your"],
  ["reicht dir das Stück. Du setzt es, dann suchst du eins für ihn aus.", "gives you the piece. Place it, then choose one for your opponent."],
  ["Wer eine Reihe, Spalte oder Diagonale aus vier Stücken vollendet, die", "Whoever completes a row, column, or diagonal of four pieces that"],
  ["mindestens eine Eigenschaft teilen", "share at least one attribute"],
  [", gewinnt — egal, wer die anderen drei gesetzt hat.", ", wins — regardless of who placed the other three."],
  ["16 Stücke,", "16 pieces,"],
  ["jedes mit vier Eigenschaften: Farbe (", "each with four attributes: color ("],
  ["), Form (rund/eckig), Größe (groß/klein), Füllung (voll/hohl).", "), shape (round/square), size (large/small), and fill (solid/hollow)."],
  ["Verbinde mit einer durchgehenden Kette eigener Steine deine beiden Ränder —", "Connect your two sides with an unbroken chain of your stones —"],
  ["Weil der erste Zug stark ist, darf ○ direkt nach dem allerersten Stein die Seiten tauschen statt selbst zu setzen.", "Because the first move is strong, ○ may swap sides after the opening stone instead of placing one."],
  ["Setze einen Stein auf ein freies Feld. Es gibt kein Unentschieden — eine Seite verbindet immer.", "Place a stone on an empty space. There is no draw — one side will always connect."],
  ["Schließe gegnerische Steine ein, um sie zu drehen. Wer am Ende mehr hat, gewinnt.", "Trap enemy stones to flip them. The player with more stones at the end wins."],
  ["Am Ende die meisten Steine deiner Farbe auf dem Brett haben.", "Finish with the most stones of your color on the board."],
  ["Mehr Kästchen einnehmen als der Gegner.", "Claim more boxes than your opponent."],
  ["Tippe eine Lücke zwischen zwei Punkten an, um diese Kante zu ziehen.", "Tap a gap between two dots to draw that edge."],
  ["Lücke zwischen zwei Punkten antippen.", "Tap a gap between two dots."],
  ["Bring einen Stein in die gegnerische Grundreihe — oder schlage alle gegnerischen Steine.", "Reach the opponent’s home row with one piece, or capture all enemy pieces."],
  ["Bring deine Figur auf die gegenüberliegende Grundreihe.", "Move your pawn to the opposite home row."],
  ["Durchbrich zur gegnerischen Grundreihe.", "Break through to the opponent’s home row."],
  ["Erreiche die gegenüberliegende Seite. Wände blockieren — aber nie komplett.", "Reach the opposite side. Walls may block paths, but never completely."],
  ["Bring alle sechs Steine ins gegenüberliegende Lager (markiert).", "Move all six pieces into the marked camp on the opposite side."],
  ["Alle Steine ins gegnerische Lager bringen.", "Move all your pieces into the opponent’s camp."],
  ["Schlage alle gegnerischen Steine. Gezogen wird ein Feld weit entlang der eingezeichneten Linien (diagonal nur an den verstärkten Punkten).", "Capture all enemy stones. Move one space along the drawn lines; diagonal moves are allowed only at reinforced intersections."],
  ["Schlage durch Annähern oder Zurückweichen. Ketten erlaubt.", "Capture by approach or withdrawal. Capture chains are allowed."],
  ["Ziehe auf ein leeres Feld — und schlage entweder durch", "Move to an empty space and capture either by"],
  ["(Gegner liegt vor dir in Zugrichtung) oder durch", "(the opponent is ahead in your movement direction) or by"],
  ["(Gegner lag hinter dir). Alle Steine in gerader Linie dahinter fallen mit.", "(the opponent was behind you). All stones in the straight line beyond it are captured too."],
  ["Schlage einen Nachbarn. Wer nicht mehr kann, verliert.", "Capture a neighbor. The first player unable to move loses."],
  ["Schließe Kästchen, dann bist du nochmal dran.", "Complete a box to take another turn."],
  ["Springe und schlage. Wer nicht mehr kann, verliert.", "Jump and capture. The first player unable to move loses."],
  ["Verbinde alle deine Steine zu einer Gruppe.", "Connect all your stones into one group."],
  ["Verbinde deine beiden Ränder mit einer durchgehenden Kette.", "Connect your two sides with an unbroken chain."],
  ["Ziehen, Pfeil schießen, den Gegner einsperren.", "Move, shoot an arrow, and trap your opponent."],
  ["König flieht in die Ecke — Angreifer wollen ihn fangen.", "The king escapes to a corner while the attackers try to capture him."],
  ["Drei in einer Reihe. Ein größerer Stein verschluckt einen kleineren.", "Make three in a row. Larger pieces can cover smaller pieces."],
  ["Stein setzen, dann einen Quadranten drehen. Fünf in einer Reihe gewinnen.", "Place a stone, then rotate a quadrant. Five in a row wins."],
  ["Vier in einer Reihe — waagerecht, senkrecht oder diagonal.", "Make four in a row horizontally, vertically, or diagonally."],
  ["Vier mit gemeinsamer Eigenschaft — der Gegner reicht dir das Stück.", "Make four with a shared attribute — your opponent chooses your piece."],
  ["Säe deine Steine gegen den Uhrzeigersinn. Mehr im eigenen Speicher gewinnt.", "Sow your stones counterclockwise. The player with more stones in their store wins."],
  ["Am Spielende mehr Steine im eigenen Speicher haben.", "Finish with more stones in your store."],
  ["✕ hat die untere Reihe und den rechten Speicher, ○ die obere Reihe und den linken. Jede Mulde startet mit vier Steinen.", "✕ owns the bottom row and right store; ○ owns the top row and left store. Every pit starts with four stones."],
  ["Im Wand-Modus eine Lücke antippen. ✕ will nach oben, ○ nach unten.", "In wall mode, tap a gap. ✕ moves upward and ○ moves downward."],
  ["Eigenen Stein wählen, dann ein leuchtendes Ziel.", "Select one of your pieces, then a highlighted destination."],
  ["Vorrat-Stein oder eigenes Feld wählen, dann Ziel antippen.", "Select a reserve piece or one of your board pieces, then tap a destination."],
  ["Nach dem Setzen ↺/↻ auf einem Quadranten wählen.", "After placing, choose ↺ or ↻ on a quadrant."],
  ["Tippe eine Spalte an. Der Stein fällt auf das unterste freie Feld.", "Tap a column. The stone falls to the lowest empty space."],
  ["Setze einen Stein auf ein beliebiges freies Feld.", "Place a stone on any empty space."],
  ["Ein Feld in jede Richtung auf ein leeres Feld.", "Move one space in any direction onto an empty space."],
  ["Es gibt ausschließlich diesen schlagenden Zug. Auf leere Felder kann man nicht ziehen.", "This capture is the only legal move. Moving onto empty spaces is not allowed."],
  ["Karte wählen", "Select card"],
  ["Figur wählen", "Select piece"],
  ["Ziel wählen", "Select destination"],
  ["Stein wählen", "Select stone"],
  ["Amazone wählen", "Select Amazon"],
  ["springenden Stein wählen", "Select jumping stone"],
  ["eigene Mulde antippen", "Tap one of your pits"],
  ["Spalte antippen", "Tap a column"],
  ["Feld antippen", "Tap a space"],
  ["Pfeil schießen", "Shoot arrow"],
  ["Quadrant drehen", "Rotate quadrant"],
  ["Symbol + Feld", "Symbol + space"],
  ["Karte + Figur wählen, dann ziehen.", "Select card and piece, then move."],
  ["STÜCK FÜR DEN GEGNER WÄHLEN", "CHOOSE A PIECE FOR YOUR OPPONENT"],
  ["wählt ein Stück für den Gegner", "chooses a piece for the opponent"],
  ["setzt das erhaltene Stück", "places the received piece"],
  ["kein Zug — Karte abgeben", "no move — discard a card"],
  ["setzt aus —", "passes —"],
  ["In welche Richtung schlagen?", "Which direction do you want to capture?"],
  ["Kette — weiter oder beenden", "Chain — continue or finish"],
  ["Nochmal dran", "Take another turn"],
  ["freie Wahl", "free choice"],
  ["Zielfeld aktiv", "destination active"],
  ["Stein setzen", "Place stone"],
  ["Zug in zwei Schritten:", "Turn in two steps:"],
  ["STÜCKE", "PIECES"],
  ["VORRAT", "RESERVE"],
  ["SO GEHT MANCALA", "HOW TO PLAY MANCALA"],
  ["SO GEHT'S", "HOW TO PLAY"],
  ["TAUSCHEN", "SWAP"],
  ["Tausch: ○ kann den Eröffnungszug übernehmen.", "Swap: ○ may take over the opening move."],
  ["Pie Rule: ○ kann den Eröffnungszug übernehmen.", "Pie rule: ○ may take over the opening move."],
  ["Tausch-Regel:", "Swap rule:"],
  ["Schlagzwang:", "Mandatory capture:"],
  ["Schlagzwang", "Mandatory capture"],
  ["Karten-Duell", "Card duel"],
  ["Karten:", "Cards:"],
  ["Kartentausch:", "Card exchange:"],
  ["Meister geschlagen", "Master captured"],
  ["Tempel erreicht", "Temple reached"],
  ["König flieht zur Ecke", "King escapes to a corner"],
  ["Annähern oder zurückweichen", "Approach or withdrawal"],
  ["Annähern", "Approach"],
  ["Zurückweichen", "Withdrawal"],
  ["Gegner schlagen", "Capture opponent"],
  ["Nachbarn schlagen", "Capture neighbors"],
  ["Springen & schlagen", "Jump & capture"],
  ["Steine umdrehen", "Flip stones"],
  ["Steine versammeln", "Gather stones"],
  ["Steine säen", "Sow stones"],
  ["Kästchen schließen", "Complete boxes"],
  ["Linie durchbrechen", "Break through the line"],
  ["Ziehen & einsperren", "Move & trap"],
  ["Setzen & Quadrant drehen", "Place & rotate a quadrant"],
  ["Drei in Reihe, gefräßig", "Three in a row, with covering"],
  ["Drei in Reihe, verschachtelt", "Nested three in a row"],
  ["Fünf in einer Reihe auf freiem Feld.", "Five in a row on an open board."],
  ["Fünf in einer Reihe", "Five in a row"],
  ["Vier in einer Reihe", "Four in a row"],
  ["Ordnung gegen Chaos", "Order versus Chaos"],
  ["Ränder verbinden", "Connect sides"],
  ["Weg zum Ziel", "Race to the goal"],
  ["Lager wechseln", "Swap camps"],
  ["Der Gegner reicht das Stück", "Your opponent chooses the piece"],
  ["21 Spiele · 2 Spieler · 1 Gerät", "21 games · 2 players · 1 device"],
  ["Gegeneinander am selben Bildschirm — oder gegen den Bot.", "Play together on one screen — or against the bot."],
  ["Siege werden automatisch gezählt — in jedem Spiel, für", "Wins are counted automatically in every game for"],
  ["Remis gesamt", "total draws"],
  ["Nichts gefunden.", "Nothing found."],
  ["Suchen…", "Search…"],
  ["ZURÜCKSETZEN", "RESET"],
  ["ZUG BEENDEN", "END TURN"],
  ["NEUSTART", "RESTART"],
  ["MÜNZWURF", "COIN FLIP"],
  ["ZUFALL", "RANDOM"],
  ["LÄUFT", "ACTIVE"],
  ["‹ MENÜ", "‹ MENU"],
  ["MENSCH", "HUMAN"],
  ["REIHE BILDEN", "MAKE A ROW"],
  ["VERBINDEN & EROBERN", "CONNECT & CONQUER"],
  ["SCHLAGEN & FANGEN", "CAPTURE"],
  ["ZIEHEN & RENNEN", "MOVE & RACE"],
  ["Spieler ✕", "Player ✕"],
  ["Spieler ○", "Player ○"],
  ["Partie zurücksetzen", "Reset game"],
  ["Gegner", "Opponent"],
  ["Sieger", "Winner"],
  ["Am Zug", "Turn"],
  ["Unentschieden", "Draw"],
  ["Remis", "Draw"],
  ["Regeln", "Rules"],
  ["Ziel:", "Goal:"],
  ["Zug:", "Turn:"],
  ["Ende:", "End:"],
  ["Sieg:", "Victory:"],
  ["Start:", "Start:"],
  ["Schritt:", "Step:"],
  ["Bewegung:", "Movement:"],
  ["Bewegen", "Move"],
  ["Schlagen:", "Capturing:"],
  ["Fangen:", "Capturing:"],
  ["Sprung:", "Jump:"],
  ["Setzen:", "Placement:"],
  ["Mehrfach:", "Multiple jumps:"],
  ["Kette:", "Chain:"],
  ["Nochmal:", "Again:"],
  ["Passen:", "Passing:"],
  ["Wände:", "Walls:"],
  ["Figuren:", "Pieces:"],
  ["Steine:", "Stones:"],
  ["Kästchen:", "Boxes:"],
  ["Dein Bereich:", "Your area:"],
  ["Der Clou:", "The twist:"],
  ["Clou:", "The twist:"],
  ["Freie Wahl:", "Free choice:"],
  ["Achtung:", "Note:"],
  ["Asymmetrisch:", "Asymmetric:"],
  ["Nur so:", "Only this way:"],
  ["Dann:", "Then:"],
  ["Pfad:", "Path:"],
  ["als Nächstes", "next"],
  ["beginnt.", "starts."],
  ["gewinnt!", "wins!"],
  ["gewinnt", "wins"],
  ["verliert", "loses"],
  ["oben/unten", "top/bottom"],
  ["links/rechts", "left/right"],
  ["obere/untere · rechts", "top/bottom · right"],
  ["Speicher links · obere Reihe", "left store · top row"],
  ["Wand ▬", "Wall ▬"],
  ["Wand ▮", "Wall ▮"],
  ["Wände", "Walls"],
  ["Angreifer", "Attackers"],
  ["Verteidiger", "Defenders"],
  ["König", "King"],
  ["KÄSEKÄSTCHEN", "DOTS AND BOXES"],
  ["Käsekästchen", "Dots and Boxes"],
  ["Amazonen", "Amazons"],
  ["Sprache", "Language"],
  ["Deutsch", "German"],
  [" und ", " and "],
  ["Ordnung", "Order"],
  ["blau", "blue"],
  ["rosé", "rose"],
  ["Ton", "Sound"],
  ["TON", "SOUND"],
];

const SORTED_REPLACEMENTS = [...EN_REPLACEMENTS].sort(
  ([sourceA], [sourceB]) => sourceB.length - sourceA.length,
);

const textState = new WeakMap();
const attributeState = new WeakMap();
const TRANSLATED_ATTRIBUTES = ["aria-label", "placeholder", "title"];

function translateText(value, language) {
  if (language !== "en") return value;
  return SORTED_REPLACEMENTS.reduce(
    (translated, [source, target]) => translated.split(source).join(target),
    value,
  );
}

function translateTextNode(node, language) {
  const current = node.nodeValue;
  const previous = textState.get(node);
  const original =
    previous && current === previous.rendered ? previous.original : current;
  const rendered = translateText(original, language);
  textState.set(node, { original, rendered });
  if (current !== rendered) node.nodeValue = rendered;
}

function translateElementAttributes(element, language) {
  const previous = attributeState.get(element) || {};
  const next = { ...previous };

  for (const attribute of TRANSLATED_ATTRIBUTES) {
    if (!element.hasAttribute(attribute)) continue;
    const current = element.getAttribute(attribute);
    const state = previous[attribute];
    const original = state && current === state.rendered ? state.original : current;
    const rendered = translateText(original, language);
    next[attribute] = { original, rendered };
    if (current !== rendered) element.setAttribute(attribute, rendered);
  }

  attributeState.set(element, next);
}

function translateTree(root, language) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root, language);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;

  translateElementAttributes(root, language);
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
  );
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) translateTextNode(node, language);
    else translateElementAttributes(node, language);
    node = walker.nextNode();
  }
}

export function usePageTranslation(language) {
  useEffect(() => {
    document.documentElement.lang = language;
    document.title =
      language === "en" ? "Hotseat Games Hub" : "Hotseat Games Hub";

    const description = document.querySelector('meta[name="description"]');
    if (description) {
      description.content =
        language === "en"
          ? "21 abstract board games for two players on one device."
          : "21 abstrakte Brettspiele für zwei Personen an einem Gerät.";
    }

    try {
      localStorage.setItem("games-hub-language", language);
    } catch {
      // Language persistence is optional when storage is unavailable.
    }

    translateTree(document.body, language);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          translateTextNode(mutation.target, language);
          continue;
        }
        if (mutation.type === "attributes") {
          translateElementAttributes(mutation.target, language);
          continue;
        }
        for (const node of mutation.addedNodes) translateTree(node, language);
      }
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: TRANSLATED_ATTRIBUTES,
    });
    return () => observer.disconnect();
  }, [language]);
}
