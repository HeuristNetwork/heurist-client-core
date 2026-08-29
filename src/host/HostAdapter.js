/**
 * HostAdapter.js - Generic host integration contract for Heurist modules
 *
 * @project     Heurist academic knowledge management system
 * @package     client-core.host
 * @link        https://HeuristNetwork.org
 * @copyright   (C) 2005-2023 University of Sydney, (C) 2024 onwards Heurist Network
 * @license     https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 * @author      Artem Osmakov <osmakov@gmail.com>
 */

/** Optional services supplied to an independent module by its embedding host. */
export class HostAdapter {
  async initialize() {}

  supportsEditing() { return false; }

  async editRecord(recordId) {
    throw new Error(`Record editing is not supported by this host (${recordId})`);
  }

  /** Return optional capabilities. Concrete modules define their public keys. */
  getCapabilities() { return {}; }

  async destroy() {}
}
