// Bridge and ornaments (modelled on the Settlers 5 expansions, see docs/ADDON.md): German texts.

import { levels } from './util.js';

export default {
  ...levels('bridge', ['Brücke']),
  ...levels('fountain', ['Brunnen']),
  ...levels('statue', ['Denkmal']),
  'bdesc.bridge': 'Nur an Brückenstellen über Flüsse. Fertig begehbar für alle; wird sie zerstört, ist der Weg wieder zu.',
  'bdesc.fountain': 'Zierde: hebt die maximale Motivation.',
  'bdesc.statue': 'Zierde: hebt die maximale Motivation deutlich.',
  'tech.mathematics': 'Mathematik',
  'tdesc.mathematics': 'Schaltet den Brückenbau an Brückenstellen frei',
  'toast.bridgeBuilt': 'Brücke fertig – der Fluss ist hier passierbar',
  'toast.bridgeCollapsed': 'Eine Brücke ist eingestürzt',
  'toast.aiDisabled': 'Computergegner {player} ist ausgefallen (Fehler in der KI) und gibt keine Befehle mehr',
  'err.bridgeSiteOnly': 'Nur an einer Brückenstelle',
  'err.unreachable': 'Ziel nicht erreichbar',
};
