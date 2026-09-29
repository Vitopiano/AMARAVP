/* Vito Piano — Bloque "Selector de set" (snippets/vp-set-selector.liquid)
   Cada pieza del set elige una opción ("choice": un producto de la familia o un color del producto)
   y, si hace falta, una talla. En formato set toma el botón de compra de la ficha y añade todas
   las piezas en una sola llamada. */

if (!customElements.get('vp-set-selector')) {
  customElements.define(
    'vp-set-selector',
    class VpSetSelector extends HTMLElement {
      connectedCallback() {
        if (this.ready) return;
        this.ready = true;

        this.data = JSON.parse(this.querySelector('[data-vps-json]').textContent);
        this.t = this.data.strings;
        this.choices = new Map(this.data.choices.map((c) => [c.k, c]));
        this.shortNames = this.buildShortNames();
        this.rows = [...this.querySelectorAll('[data-row]')];
        this.form = document.getElementById(this.dataset.form);
        this.submitBtn = this.form?.querySelector('[name="add"]');
        this.btnLabel = this.submitBtn?.querySelector('span');
        this.stickyPrice = document.getElementById('vp-sticky-price');

        this.querySelectorAll('[data-vps-name]').forEach((label) => {
          const input = document.getElementById(label.htmlFor);
          if (input) label.textContent = this.shortNames.get(input.value) ?? label.textContent;
        });

        this.note = document.createElement('p');
        this.note.className = 'vps__note';
        this.note.setAttribute('aria-live', 'polite');
        const buttons = this.form?.querySelector('.product-form__buttons');
        if (buttons) buttons.after(this.note);

        const keys = this.data.choices.map((c) => c.k);
        const available = keys.filter((k) => !this.choiceOut(k));
        const start = this.choices.has(this.data.initial) && !this.choiceOut(this.data.initial) ? this.data.initial : available[0] ?? keys[0];
        const from = Math.max(available.indexOf(start), 0);
        this.state = {
          mode: this.dataset.mode === 'ind' ? 'ind' : 'set',
          open: 0,
          set: this.rows.map((_, i) => {
            const k = i === 0 || !available.length ? start : available[(from + i) % available.length];
            return { k, s: this.autoSize(k) };
          }),
        };

        this.onSubmit = this.onSubmit.bind(this);
        document.addEventListener('submit', this.onSubmit, true);
        this.addEventListener('click', this.onClick.bind(this));
        this.addEventListener('change', this.onChange.bind(this));
        this.update();
      }

      disconnectedCallback() {
        document.removeEventListener('submit', this.onSubmit, true);
        this.note?.remove();
      }

      /* ——— Datos ——— */

      /* "Cinturón Trenzado Elástico Positano" → "Positano" cuando todas las opciones comparten el inicio. */
      buildShortNames() {
        const names = this.data.choices.map((c) => c.n);
        const words = names.map((n) => n.split(/\s+/));
        let common = 0;
        if (names.length > 1) {
          while (words.every((w) => w.length > common + 1 && w[common].toLowerCase() === words[0][common].toLowerCase())) common++;
        }
        return new Map(this.data.choices.map((c, i) => [c.k, words[i].slice(common).join(' ')]));
      }

      sizesOf(k) {
        const c = this.choices.get(k);
        return c ? [...new Set(c.v.map((v) => v.s).filter((s) => s != null))] : [];
      }

      needsSize(k) {
        return this.sizesOf(k).length > 1;
      }

      autoSize(k) {
        const sizes = this.sizesOf(k);
        return sizes.length === 1 ? sizes[0] : null;
      }

      variantFor(sel) {
        const c = this.choices.get(sel.k);
        if (!c) return null;
        if (!this.sizesOf(sel.k).length) return c.v[0];
        return c.v.find((v) => v.s === sel.s) || null;
      }

      choiceOut(k) {
        return !this.choices.get(k)?.v.some((v) => v.a);
      }

      sizeOut(k, s) {
        const v = this.choices.get(k)?.v.find((x) => x.s === s);
        return !v || !v.a;
      }

      complete(sel) {
        const v = this.variantFor(sel);
        return Boolean(v && v.a);
      }

      swatchOf(scope, k) {
        const input = [...scope.querySelectorAll('[data-vps-choice]')].find((i) => i.value === k);
        const sw = input?.nextElementSibling?.querySelector('.swatch');
        return sw ? sw.style.getPropertyValue('--swatch--background') : '';
      }

      /* ——— Render ——— */
      update() {
        const isSet = this.state.mode === 'set';
        this.dataset.mode = this.state.mode;
        this.querySelectorAll('[data-fmt]').forEach((b) => b.setAttribute('aria-checked', b.dataset.fmt === this.state.mode));
        this.querySelector('[data-vps-set]').hidden = !isSet;

        this.rows.forEach((row, i) => {
          const sel = this.state.set[i];
          const scope = row.querySelector('[data-scope]');
          const open = this.state.open === i;
          row.classList.toggle('is-open', open);
          row.querySelector('[data-row-toggle]').setAttribute('aria-expanded', open);
          row.querySelector('.vps-row__body').inert = !open;

          scope.querySelectorAll('[data-vps-choice]').forEach((input) => {
            const out = this.choiceOut(input.value);
            const isSwatch = input.classList.contains('swatch-input__input');
            input.checked = input.value === sel.k;
            input.disabled = out;
            input.classList.toggle('visually-disabled', out && isSwatch);
            input.classList.toggle('disabled', out && !isSwatch);
          });

          const sizes = this.sizesOf(sel.k);
          const sizeSet = scope.querySelector('[data-vps-sizes]');
          if (sizeSet) sizeSet.style.display = this.needsSize(sel.k) ? '' : 'none';
          scope.querySelectorAll('[data-vps-size]').forEach((input) => {
            const present = sizes.includes(input.value);
            input.style.display = present ? '' : 'none';
            input.nextElementSibling.style.display = present ? '' : 'none';
            const out = this.sizeOut(sel.k, input.value);
            input.checked = input.value === sel.s;
            input.disabled = out;
            input.classList.toggle('disabled', out);
          });

          const name = this.shortNames.get(sel.k) ?? '';
          const cname = scope.querySelector('[data-cname]');
          if (cname) cname.textContent = name;

          const dot = row.querySelector('.vps-row__dot');
          const swatch = this.swatchOf(scope, sel.k);
          dot.style.setProperty('--c', swatch || 'transparent');
          dot.hidden = !swatch;

          const sum = row.querySelector('[data-row-sum]');
          sum.textContent = this.data.choices.length > 1 || !this.needsSize(sel.k) ? name : '';
          if (!this.needsSize(sel.k)) return;
          if (sum.textContent) sum.append(' · ');
          if (sel.s) {
            const label = this.data.sizeName.length <= 8 ? `${this.data.sizeName} ` : '';
            sum.append(`${label}${sel.s}`);
          } else {
            const em = document.createElement('em');
            em.textContent = `Elige ${this.data.sizeName.toLowerCase()}`;
            sum.append(em);
          }
        });

        this.applyBuyButton();
        this.note.textContent = isSet ? this.t.noteSet : this.t.noteInd;
      }

      /* El botón de compra de la ficha cambia de texto en formato set y vuelve a su estado al salir. */
      applyBuyButton() {
        if (!this.submitBtn || !this.btnLabel) return;
        const isSet = this.state.mode === 'set';
        if (isSet && this.applied !== 'set') {
          this.saved = {
            label: this.btnLabel.textContent,
            disabled: this.submitBtn.disabled,
            sticky: this.stickyPrice?.textContent,
          };
        }
        if (isSet) {
          if (!this.flashing) this.btnLabel.textContent = this.t.ctaSet;
          this.submitBtn.disabled = false;
          if (this.stickyPrice) this.stickyPrice.textContent = this.t.priceSet;
        } else if (this.applied === 'set' && this.saved) {
          this.btnLabel.textContent = this.saved.label;
          this.submitBtn.disabled = this.saved.disabled;
          if (this.stickyPrice && this.saved.sticky != null) this.stickyPrice.textContent = this.saved.sticky;
        }
        this.applied = this.state.mode;
      }

      /* ——— Eventos ——— */
      onClick(e) {
        const b = e.target.closest('button');
        if (!b || !this.contains(b)) return;
        if (b.dataset.fmt) {
          this.state.mode = b.dataset.fmt;
          return this.update();
        }
        if (b.dataset.rowToggle !== undefined) {
          const i = Number(b.dataset.rowToggle);
          this.state.open = this.state.open === i ? -1 : i;
          this.update();
        }
      }

      onChange(e) {
        const input = e.target;
        const scope = input.closest('[data-scope]');
        if (!scope) return;
        const i = Number(scope.dataset.scope);
        const sel = this.state.set[i];

        if (input.hasAttribute('data-vps-choice')) {
          sel.k = input.value;
          const auto = this.autoSize(sel.k);
          if (auto) sel.s = auto;
          else if (sel.s && (!this.sizesOf(sel.k).includes(sel.s) || this.sizeOut(sel.k, sel.s))) sel.s = null;
          if (this.needsSize(sel.k)) return this.update();
          return this.advance(i);
        }

        if (input.hasAttribute('data-vps-size')) {
          sel.s = input.value;
          this.advance(i);
        }
      }

      /* Cierra la fila completa y abre la siguiente. */
      advance(i) {
        const next = i + 1 < this.rows.length ? i + 1 : -1;
        this.state.open = next;
        this.update();
        this.rows[next >= 0 ? next : i].querySelector('[data-row-toggle]').focus({ preventScroll: true });
      }

      onSubmit(e) {
        if (e.target !== this.form || this.state.mode !== 'set') return;
        e.preventDefault();
        e.stopImmediatePropagation();
        this.addSet();
      }

      async addSet() {
        if (this.busy) return;
        const missing = this.state.set.findIndex((p) => !this.complete(p));
        if (missing >= 0) {
          this.state.open = missing;
          this.update();
          this.note.textContent = this.t.missingRow.replace('[n]', String(missing + 1).padStart(2, '0'));
          this.rows[missing].scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }

        const qty = new Map();
        this.state.set.forEach((p) => {
          const id = this.variantFor(p).id;
          qty.set(id, (qty.get(id) || 0) + 1);
        });
        const body = { items: [...qty].map(([id, quantity]) => ({ id, quantity })) };

        const cart = document.querySelector('cart-drawer') || document.querySelector('cart-notification');
        if (cart && typeof cart.getSectionsToRender === 'function') {
          body.sections = cart.getSectionsToRender().map((s) => s.id);
          body.sections_url = window.location.pathname;
          cart.setActiveElement?.(this.submitBtn);
        }

        this.busy = true;
        const spinner = this.submitBtn?.querySelector('.loading__spinner');
        this.submitBtn?.classList.add('loading');
        this.submitBtn?.setAttribute('aria-disabled', 'true');
        spinner?.classList.remove('hidden');

        try {
          const res = await fetch(`${window.routes?.cart_add_url || '/cart/add'}.js`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            body: JSON.stringify(body),
          });
          const json = await res.json();
          if (json.status) {
            this.note.textContent = json.description || json.message || this.t.error;
            return;
          }

          if (typeof publish === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
            publish(PUB_SUB_EVENTS.cartUpdate, { source: 'vp-set-selector', cartData: json });
          }

          if (cart && cart.tagName === 'CART-DRAWER') {
            cart.classList.remove('is-empty');
            cart.renderContents(json);
          } else if (window.routes?.cart_url) {
            window.location = window.routes.cart_url;
            return;
          }
          this.flash();
        } catch (err) {
          console.error(err);
          this.note.textContent = this.t.error;
        } finally {
          this.busy = false;
          this.submitBtn?.classList.remove('loading');
          this.submitBtn?.removeAttribute('aria-disabled');
          spinner?.classList.add('hidden');
        }
      }

      flash() {
        if (!this.btnLabel) return;
        clearTimeout(this.flashing);
        this.btnLabel.textContent = this.t.added;
        this.flashing = setTimeout(() => {
          this.flashing = null;
          if (this.state.mode === 'set') this.btnLabel.textContent = this.t.ctaSet;
        }, 2200);
      }
    }
  );
}
