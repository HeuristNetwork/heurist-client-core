/**
 * InlineHelp.js - Full-viewport inline user manual viewer
 *
 * Loads `{moduleName}UserManual{Lang}.htm` from the module's own public/
 * directory into an iframe. Each consuming module supplies its own manual
 * files; this component only knows the naming convention and overlay chrome.
 *
 * @project     Heurist academic knowledge management system
 * @package     client-core.ui
 * @link        https://HeuristNetwork.org
 * @copyright   (C) 2024 onwards Heurist Network
 * @license     https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 * @author      Artem Osmakov <osmakov@gmail.com>
 */
import { HMsg } from './HMsg.js';
import { $HR, getActiveLanguage, getAssetBaseUrl } from './i18n/HResource.js';

let helpDialogSeq = 0;

export class InlineHelp {
  constructor({ parent = null, moduleName } = {}) {
    if (!moduleName) throw new Error('InlineHelp requires a moduleName');
    this.moduleName = moduleName;
    this.parent = parent;
    this.dialogId = `dialog-inline-help-${++helpDialogSeq}`;
    this.dlg = null;
  }

  open() {
    const dlg = HMsg.getMsgDlg(this.dialogId);
    (this.parent || document.body).append(dlg);
    dlg.classList.add('h-dialog-fullscreen');

    const title = dlg.querySelector('.h-dialog-title');
    title.textContent = $HR('Help');
    dlg.querySelector('.h-dialog-footer').hidden = true;

    const body = dlg.querySelector('.h-dialog-body');
    body.classList.add('h-dialog-body-flush');
    body.replaceChildren();

    const frame = document.createElement('iframe');
    frame.className = 'h-dialog-iframe';
    frame.src = this.manualUrl();
    frame.title = $HR('Help');
    body.append(frame);

    this.dlg = dlg;
    dlg.showModal();
  }

  close() {
    this.dlg?.close();
  }

  manualUrl() {
    const language = getActiveLanguage();
    const suffix = language.charAt(0).toUpperCase() + language.slice(1);
    const base = String(getAssetBaseUrl() || '').replace(/\/+$/, '');
    return `${base}/${this.moduleName}UserManual${suffix}.htm`;
  }
}
