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
import { $HR, getActiveLanguage, getAssetBaseUrl } from './i18n/HResource.js';

export class InlineHelp {
  constructor({ parent = null, moduleName } = {}) {
    if (!moduleName) throw new Error('InlineHelp requires a moduleName');
    this.moduleName = moduleName;
    this.parent = parent;
    this.element = null;
    this.onKeyDown = (event) => { if (event.key === 'Escape') this.close(); };
  }

  open() {
    if (this.element) return;

    this.element = document.createElement('div');
    this.element.className = 'heurist-help-backdrop';
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');

    const dialog = document.createElement('div');
    dialog.className = 'heurist-help-dialog';

    const header = document.createElement('div');
    header.className = 'heurist-help-header';
    const heading = document.createElement('strong');
    heading.className = 'h-i18n';
    heading.textContent = 'Help';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'heurist-help-close';
    close.setAttribute('aria-label', $HR('Close'));
    close.textContent = '×';
    close.addEventListener('click', () => this.close());
    header.append(heading, close);

    const frame = document.createElement('iframe');
    frame.className = 'heurist-help-frame';
    frame.src = this.manualUrl();
    frame.title = $HR('Help');

    dialog.append(header, frame);
    this.element.append(dialog);
    (this.parent || document.body).append(this.element);
    document.addEventListener('keydown', this.onKeyDown);
    close.focus();
  }

  close() {
    document.removeEventListener('keydown', this.onKeyDown);
    this.element?.remove();
    this.element = null;
  }

  manualUrl() {
    const language = getActiveLanguage();
    const suffix = language.charAt(0).toUpperCase() + language.slice(1);
    const base = String(getAssetBaseUrl() || '').replace(/\/+$/, '');
    return `${base}/${this.moduleName}UserManual${suffix}.htm`;
  }
}
