/* Vito Piano — Bloque "Selector de set" (snippets/vp-set-selector.liquid)
   En formato set toma el botón de compra de la ficha y añade todas las piezas en una sola llamada. */

if (!customElements.get('vp-set-selector')) {
  customElements.define(
    'vp-set-selector',
    class VpSetSelector extends HTMLElement {
      connectedCallback() {
        if (this.ready) return;
        this.ready = true;

        this.data = JSON.parse(this.querySelector('[data-vps-json]').textContent);
        this.t = this.data.strings;
        this.rows = [...this.querySelectorAll('[data-row]')];
        this.form = document.getElementById(this.dataset.form);
        this.submitBtn = this.form?.querySelector('[name="add"]');
        this.btnLabel = this.submitBtn?.querySelector('span');
        this.stickyPrice = document.getElementById('vp-sticky-price');

        this.note = document.createElement('p');
        this.note.className = 'vps__note';
        this.note.setAttribute('aria-live', 'polite');
        const buttons = this.form?.querySelector('.product-form__buttons');
        if (buttons) buttons.after(this.note);

        const available = this.data.colors.filter((c) => !this.colorOut(c));
        const pick = (i) => (available.length ? available[i % available.length] : this.data.colors[0] ?? null);
        const start = this.data.initialColor && !this.colorOut(this.data.initialColor) ? this.data.initialColor : pick(0);
        const colorsFor = this.rows.map((_, i) => (i === 0 ? start : pick(available.indexOf(start) + i)));

        this.state = {
          mode: this.dataset.mode === 'ind' ? 'ind' : 'set',
          open: 0,
          set: this.rows.map((_, i) => ({ c: colorsFor[i], s: this.onlySize() })),
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
      onlySize() {
        if (!this.data.hasSize) return null;
        const sizes = [...new Set(this.data.variants.map((v) => v.s))];
        return sizes.length === 1 ? sizes[0] : null;
      }

      find(c, s) {
        return this.data.variants.find((v) => (!this.data.hasColor || v.c === c) && (!this.data.hasSize || v.s === s));
      }

      colorOut(c) {
        return !this.data.variants.some((v) => (!this.data.hasColor || v.c === c) && v.a);
      }

      sizeOut(c, s) {
        const v = this.find(c, s);
        return !v || !v.a;
      }

      complete(sel) {
        if (this.data.hasSize && !sel.s) return false;
        const v = this.find(sel.c, sel.s);
        return Boolean(v && v.a);
      }

      swatchOf(scope, c) {
        const input = [...scope.querySelectorAll('[data-vps-color]')].find((i) => i.value === c);
        const sw = input?.nextElementSibling?.querySelector('.swatch');
        return sw ? sw.style.getPropertyValue('--swatch--background') : 'transparent';
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

          scope.querySelectorAll('[data-vps-color]').forEach((input) => {
            const out = this.colorOut(input.value);
            input.checked = input.value === sel.c;
            input.disabled = out;
            input.classList.toggle('visually-disabled', out && input.classList.contains('swatch-input__input'));
            input.classList.toggle('disabled', out && !input.classList.contains('swatch-input__input'));
          });
          scope.querySelectorAll('[data-vps-size]').forEach((input) => {
            const out = this.sizeOut(sel.c, input.value);
            input.checked = input.value === sel.s;
            input.disabled = out;
            input.classList.toggle('disabled', out);
          });
          const cname = scope.querySelector('[data-cname]');
          if (cname) cname.textContent = sel.c ?? '';

          row.querySelector('.vps-row__dot').style.setProperty('--c', this.swatchOf(scope, sel.c));
          const sum = row.querySelector('[data-row-sum]');
          sum.textContent = this.data.hasColor ? sel.c ?? '' : '';
          if (!this.data.hasSize) return;
          if (this.data.hasColor) sum.append(' · ');
          if (sel.s) {
            sum.append(`${this.data.sizeName} ${sel.s}`);
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

        if (input.hasAttribute('data-vps-color')) {
          sel.c = input.value;
          if (sel.s && this.sizeOut(sel.c, sel.s)) sel.s = null;
          return this.update();
        }

        if (input.hasAttribute('data-vps-size')) {
          sel.s = input.value;
          const next = i + 1 < this.rows.length ? i + 1 : -1;
          this.state.open = next;
          this.update();
          this.rows[next >= 0 ? next : i].querySelector('[data-row-toggle]').focus({ preventScroll: true });
        }
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
          const id = this.find(p.c, p.s).id;
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
