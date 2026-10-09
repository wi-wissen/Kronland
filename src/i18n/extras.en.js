// Bridge and ornaments (modelled on the Settlers 5 expansions, see docs/ADDON.md): English texts.

import { levels } from './util.js';

export default {
  ...levels('bridge', ['Bridge']),
  ...levels('fountain', ['Fountain']),
  ...levels('statue', ['Monument']),
  'bdesc.bridge': 'Only on bridge sites across rivers. Once built anyone may cross; if it is destroyed, the way is closed again.',
  'bdesc.fountain': 'Ornament: raises maximum motivation.',
  'bdesc.statue': 'Ornament: raises maximum motivation considerably.',
  'tech.mathematics': 'Mathematics',
  'tdesc.mathematics': 'Unlocks building bridges on bridge sites',
  'toast.bridgeBuilt': 'Bridge finished – the river can be crossed here',
  'toast.bridgeCollapsed': 'A bridge has collapsed',
  'toast.aiDisabled': 'Computer opponent {player} has failed (AI error) and gives no more commands',
  'err.bridgeSiteOnly': 'Only on a bridge site',
  'err.unreachable': 'Target unreachable',
};
