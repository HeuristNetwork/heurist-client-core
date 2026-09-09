/**
 * @file HFilter.js
 * @brief Compact datasource selector for direct Heurist queries and saved filters.
 * @package heurist-client-core
 */
import { HBaseWidget } from './HBaseWidget.js';
import { HMsg } from '../ui/HMsg.js';
import { $HR } from '../ui/i18n/index.js';

const DEFAULT_OPTIONS = Object.freeze({
  showSearchTools: true,
  showFilterSearch: true,
  showGroupFilter: true,
  showTypeFilter: true,
  filterIds: null,
  activeFilterId: null,
  groupLabels: null,
  onSearchTools: null,
  classifyFilter: null,
  resolveParameterizedFilter: null,
  onDataSource: null,
});

/**
 * Produces validated DataSource objects from a direct query or a saved filter.
 * The widget deliberately knows nothing about module/layout synchronisation.
 */
export class HFilter extends HBaseWidget {
  constructor({ apiClient = null } = {}) {
    super();
    this.apiClient = apiClient;
    this.filters = [];
    this.filteredFilters = [];
    this.activeFilterId = null;
    this._loadController = null;
    this._countController = null;
  }

  attach(container, options = {}) {
    super.attach(container, { ...DEFAULT_OPTIONS, ...options });
    this.apiClient = options.apiClient ?? this.apiClient;
    if (!this.apiClient) throw new TypeError('HFilter requires apiClient');
    this.activeFilterId = normalizePositiveId(this.options.activeFilterId);
    return this;
  }

  async render() {
    if (!this.container) throw new Error('HFilter must be attached before render');
    this.clearListeners();
    this.container.classList.add('h-widget', 'h-filter');
    this.container.innerHTML = this._template();
    this._bindEvents();
    this.state = 'rendered';
    await this.loadFilters();
    return this;
  }

  _template() {
    return `
      <section class="h-filter-section h-filter-direct">
        <div class="h-filter-section-title">${escapeHtml($HR('Search'))}</div>
        <div class="h-filter-query-row">
          <input class="h-input h-grow h-filter-query" type="text"
                 placeholder="${escapeHtml($HR('Enter query'))}" aria-label="${escapeHtml($HR('Search query'))}">
          <button class="h-btn h-btn-primary" type="button" data-action="search">${escapeHtml($HR('Search'))}</button>
          ${this.options.showSearchTools ? `<button class="h-btn" type="button" data-action="search-tools">${escapeHtml($HR('Search tools'))}</button>` : ''}
        </div>
        <div class="h-filter-status h-muted" data-role="query-status" aria-live="polite"></div>
      </section>

      <section class="h-filter-section h-filter-saved">
        <div class="h-filter-section-title">${escapeHtml($HR('Saved filters'))}</div>
        <div class="h-filter-controls">
          ${this.options.showFilterSearch ? `<input class="h-input h-grow" type="search" data-role="filter-search" placeholder="${escapeHtml($HR('Search filters'))}">` : ''}
          ${this.options.showGroupFilter ? `<select class="h-select" data-role="group-filter" aria-label="${escapeHtml($HR('User group'))}"><option value="">${escapeHtml($HR('All groups'))}</option></select>` : ''}
          ${this.options.showTypeFilter ? `<select class="h-select" data-role="type-filter" aria-label="${escapeHtml($HR('Filter type'))}"><option value="">${escapeHtml($HR('All types'))}</option><option value="simple">${escapeHtml($HR('Simple'))}</option><option value="parametrized">${escapeHtml($HR('Parametrized'))}</option></select>` : ''}
        </div>
        <div class="h-filter-list" data-role="filter-list" role="listbox"></div>
        <div class="h-filter-status h-muted" data-role="filter-status" aria-live="polite"></div>
      </section>`;
  }

  _bindEvents() {
    const queryInput = this.$('.h-filter-query');
    this.listen(queryInput, 'keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void this.executeDirectQuery();
      }
    });
    this.listen(this.$('[data-action="search"]'), 'click', () => void this.executeDirectQuery());
    this.listen(this.$('[data-action="search-tools"]'), 'click', () => this.openSearchTools());
    this.listen(this.$('[data-role="filter-search"]'), 'input', () => this.applyFilterList());
    this.listen(this.$('[data-role="group-filter"]'), 'change', () => this.applyFilterList());
    this.listen(this.$('[data-role="type-filter"]'), 'change', () => this.applyFilterList());
    this.delegate(this.$('[data-role="filter-list"]'), 'click', '[data-filter-id]', (_event, row) => {
      void this.activateFilter(Number(row.dataset.filterId));
    });
  }

  async loadFilters() {
    this._loadController?.abort();
    this._loadController = new AbortController();
    this._setFilterStatus($HR('Loading') + '…');
    try {
      const q = { t: 'filter', filterType: 'filter' };
      const ids = normalizeIds(this.options.filterIds);
      if (ids.length) q.ids = ids.join(',');
      const payload = await this.apiClient.get('/sys', {
        query: { q, fields: 'query,filterType' },
        signal: this._loadController.signal,
      });
      const source = Array.isArray(payload) ? payload : payload?.items || payload?.filters || payload?.records || [];
      this.filters = source.map((value) => this._normalizeFilter(value)).filter(Boolean);
      this._populateGroupFilter();
      this.applyFilterList();
      this._setFilterStatus('');
    } catch (error) {
      if (error?.name === 'AbortError') return;
      this._setFilterStatus($HR('Cannot load filters'));
      HMsg.showMsgErr(error?.message || String(error));
    }
  }

  _normalizeFilter(value) {
    const id = normalizePositiveId(value?.rec_ID ?? value?.id ?? value?.svs_ID);
    if (!id) return null;
    const details = value?.details || {};
    const query = detailValue(details, 'query') ?? value?.query ?? null;
    const storedType = detailValue(details, 'filterType') ?? value?.filterType ?? null;
    const definition = parseSavedFilterDefinition(query);
    const classifier = this.options.classifyFilter;
    const kind = typeof classifier === 'function'
      ? classifier(value, definition)
      : inferFilterKind(value, definition);
    return {
      id,
      title: String(value?.rec_Title ?? value?.title ?? `Filter ${id}`),
      ownerGroupId: normalizePositiveId(value?.rec_OwnerUGrpID ?? value?.ownerGroupId ?? value?.svs_UGrpID),
      query,
      definition,
      storedType,
      kind,
      raw: value,
    };
  }

  _populateGroupFilter() {
    const select = this.$('[data-role="group-filter"]');
    if (!select) return;
    const current = select.value;
    select.length = 1;
    const ids = [...new Set(this.filters.map((f) => f.ownerGroupId).filter(Boolean))].sort((a, b) => a - b);
    for (const id of ids) {
      const option = document.createElement('option');
      option.value = String(id);
      option.textContent = this._groupLabel(id);
      select.append(option);
    }
    if ([...select.options].some((o) => o.value === current)) select.value = current;
  }

  _groupLabel(id) {
    const labels = this.options.groupLabels;
    if (labels instanceof Map && labels.has(id)) return String(labels.get(id));
    if (labels && typeof labels === 'object' && labels[id] != null) return String(labels[id]);
    return `${$HR('Group')} ${id}`;
  }

  applyFilterList() {
    const text = String(this.$('[data-role="filter-search"]')?.value || '').trim().toLowerCase();
    const group = normalizePositiveId(this.$('[data-role="group-filter"]')?.value);
    const type = String(this.$('[data-role="type-filter"]')?.value || '');
    this.filteredFilters = this.filters.filter((filter) => {
      if (text && !filter.title.toLowerCase().includes(text)) return false;
      if (group && filter.ownerGroupId !== group) return false;
      if (type && filter.kind !== type) return false;
      return true;
    });
    this._renderFilterList();
  }

  _renderFilterList() {
    const list = this.$('[data-role="filter-list"]');
    if (!list) return;
    list.replaceChildren();
    if (!this.filteredFilters.length) {
      const empty = document.createElement('div');
      empty.className = 'h-filter-empty h-muted';
      empty.textContent = $HR('No filters');
      list.append(empty);
      return;
    }
    for (const filter of this.filteredFilters) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'h-filter-row';
      row.dataset.filterId = String(filter.id);
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', filter.id === this.activeFilterId ? 'true' : 'false');
      if (filter.id === this.activeFilterId) row.classList.add('is-active');

      const title = document.createElement('span');
      title.className = 'h-filter-row-title';
      title.textContent = filter.title;
      const meta = document.createElement('span');
      meta.className = 'h-filter-row-meta';
      meta.textContent = filter.kind === 'parametrized' ? $HR('Parametrized') : '';
      row.append(title, meta);
      list.append(row);
    }
  }

  openSearchTools() {
    if (typeof this.options.onSearchTools === 'function') {
      this.options.onSearchTools({ widget: this, query: this.$('.h-filter-query')?.value ?? '' });
      return;
    }
    this._emit('searchtools', { query: this.$('.h-filter-query')?.value ?? '' });
  }

  async executeDirectQuery(value = null) {
    const input = this.$('.h-filter-query');
    const raw = value ?? input?.value ?? '';
    const request = normalizeDirectQuery(raw);
    if (!request || isEmptyQuery(request)) {
      this._setQueryStatus($HR('Enter query'));
      return null;
    }
    this._setQueryStatus($HR('Checking') + '…');
    try {
      const count = await this._count(request);
      const dataSource = { type: 'query', query: request, count };
      this.activeFilterId = null;
      this._renderFilterList();
      this._setQueryStatus(formatCount(count));
      this._publish(dataSource);
      return dataSource;
    } catch (error) {
      if (error?.name === 'AbortError') return null;
      this._setQueryStatus($HR('Invalid query'));
      HMsg.showMsgErr(error?.message || String(error));
      return null;
    }
  }

  async activateFilter(id) {
    let filter = this.filters.find((item) => item.id === Number(id));
    if (!filter) return null;
    try {
      // List endpoints may omit the full query in future configurations; load lazily when necessary.
      if (!filter.query) {
        const value = await this.apiClient.get(`/sys/filter/${filter.id}`);
        filter = this._normalizeFilter(value);
      }
      let request = executableRequest(filter.definition);
      if (filter.kind === 'parametrized') {
        if (typeof this.options.resolveParameterizedFilter !== 'function') {
          this._emit('parameterizedfilter', { filter });
          return null;
        }
        const resolved = await this.options.resolveParameterizedFilter({ filter, widget: this });
        if (!resolved) return null;
        request = normalizeSearchRequest(resolved);
      }
      if (!request || isEmptyQuery(request)) throw new Error($HR('Saved filter does not contain a query'));
      this._setFilterStatus($HR('Checking') + '…');
      const count = await this._count(request);
      const dataSource = {
        type: 'filter',
        id: filter.id,
        title: filter.title,
        query: request,
        count,
      };
      this.activeFilterId = filter.id;
      this._renderFilterList();
      this._setFilterStatus(formatCount(count));
      this._publish(dataSource);
      return dataSource;
    } catch (error) {
      if (error?.name === 'AbortError') return null;
      this._setFilterStatus($HR('Cannot apply filter'));
      HMsg.showMsgErr(error?.message || String(error));
      return null;
    }
  }

  async _count(request) {
    this._countController?.abort();
    this._countController = new AbortController();
    const query = { ...request, detail: 'count' };
    delete query.isNewEngine;
    delete query.search_realm;
    delete query.source;
    const payload = await this.apiClient.get('/records', { query, signal: this._countController.signal });
    const value = Number(payload?.count ?? payload?.total ?? payload?.records_count ?? (typeof payload === 'number' ? payload : NaN));
    if (!Number.isFinite(value) || value < 0) throw new Error($HR('Cannot determine result count'));
    return value;
  }

  _publish(dataSource) {
    this.options.onDataSource?.(dataSource, this);
    this._emit('datasourcechange', dataSource);
  }

  _emit(name, detail) {
    this.container?.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
  }

  _setQueryStatus(text) { const el = this.$('[data-role="query-status"]'); if (el) el.textContent = text || ''; }
  _setFilterStatus(text) { const el = this.$('[data-role="filter-status"]'); if (el) el.textContent = text || ''; }

  async destroy() {
    this._loadController?.abort();
    this._countController?.abort();
    await super.destroy();
  }
}

/** Normalize the persisted saved-filter JSON to the executable /records subset. */
export function parseSavedFilterDefinition(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return { ...value };
  const text = String(value ?? '').trim();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { q: text };
  } catch {
    return { q: text };
  }
}

export function normalizeDirectQuery(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if ('q' in value || 'rules' in value || 'rulesonly' in value) return normalizeSearchRequest(value);
    return { q: value };
  }
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        if ('q' in parsed || 'rules' in parsed || 'rulesonly' in parsed) return normalizeSearchRequest(parsed);
        return { q: parsed };
      }
    } catch { /* ordinary Heurist query string */ }
  }
  return { q: text };
}

export function executableRequest(definition) {
  return normalizeSearchRequest(definition || {});
}

function normalizeSearchRequest(value) {
  const request = {};
  if (value.q !== undefined) request.q = value.q;
  if (value.query !== undefined && request.q === undefined) request.q = value.query;
  if (value.rules !== undefined && value.rules !== null) request.rules = value.rules;
  if (value.rulesonly !== undefined && value.rulesonly !== null) request.rulesonly = value.rulesonly;
  if (value.w !== undefined && value.w !== null && value.w !== '') request.w = value.w;
  return request;
}

function inferFilterKind(value, definition) {
  const explicit = value?.kind ?? value?.parameterized ?? value?.parametrized ?? definition?.filterKind ?? definition?.parameterized ?? definition?.parametrized;
  if (explicit === true || String(explicit).toLowerCase() === 'parametrized' || String(explicit).toLowerCase() === 'parameterized') return 'parametrized';
  return 'simple';
}

function isEmptyQuery(request) {
  const q = request?.q;
  const qEmpty = q == null || q === '' || (typeof q === 'object' && !Array.isArray(q) && Object.keys(q).length === 0);
  const rulesEmpty = request?.rules == null || request.rules === '' || (Array.isArray(request.rules) && request.rules.length === 0);
  return qEmpty && rulesEmpty;
}

function detailValue(details, field) {
  const values = details?.[field];
  if (!Array.isArray(values) || !values.length) return null;
  return values[0]?.value ?? null;
}
function normalizePositiveId(value) { const id = Number(value); return Number.isInteger(id) && id > 0 ? id : null; }
function normalizeIds(value) { const arr = Array.isArray(value) ? value : value == null ? [] : [value]; return [...new Set(arr.map(normalizePositiveId).filter(Boolean))]; }
function formatCount(count) { return `${count.toLocaleString()} ${$HR(count === 1 ? 'record' : 'records')}`; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c])); }
