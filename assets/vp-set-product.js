/* Vito Piano — Ficha con set (sections/vp-set-product.liquid)
   Maneja el formato (individual / set), el selector por fila y el envío a la bolsa. */

if (!customElements.get('vp-set-product')) {
  customElements.define(
    'vp-set-product',
    class VpSetProduct extends HTMLElement {
      connectedCallback() {
        if (this.ready) return;
        this.ready = true;

        this.data = JSON.parse(this.querySelector('[data-vps-json]').textContent);
        this.t = this.data.strings;
        this.rows = [...this.querySelectorAll('[data-row]')];
        this.cta = this.querySelector('[data-vps-cta]');
        this.note = this.querySelector('[data-vps-note]');
        this.track = this.querySelector('.vps__track');

        const available = this.data.colors.filter((c) => !this.colorOut(c));
        const pick = (i) => (available.length ? available[i % available.length] : this.data.colors[0] ?? null);
        const onlySize = this.onlySize();
        const initial = this.data.initialColor && !this.colorOut(this.data.initialColor) ? this.data.initialColor : pick(0);

        this.state = {
          fmt: this.rows.length ? this.dataset.defaultFormat : 'ind',
          open: 0,
          set: this.rows.map((_, i) => ({ c: pick(i), s: onlySize })),
          ind: { c: initial, s: onlySize },
        };

        this.addEventListener('click', this.onClick.bind(this));
        if (this.track) {
          this.track.addEventListener('scroll', () => requestAnimationFrame(() => this.updateCounter()), { passive: true });
        }
        this.update();
      }

      /* ——— Datos ——— */
      onlySize() {
        if (!this.data.hasSize) return null;
        const sizes = [...new Set(this.data.variants.map((v) => v.s))];
        return sizes.length === 1 ? sizes[0] : null;
      }

      find(c, s) {
        return this.data.variants.find(
          (v) => (!this.data.hasColor || v.c === c) && (!this.data.hasSize || v.s === s)
        );
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

      sel(scope) {
        return scope === 'ind' ? this.state.ind : this.state.set[Number(scope)];
      }

      swatchOf(c) {
        const b = this.querySelector(`.vps-sw[data-color="${CSS.escape(c ?? '')}"]`);
        return b ? b.style.getPropertyValue('--c') : 'transparent';
      }

      /* ——— Render ——— */
      update() {
        const isSet = this.state.fmt === 'set';

        this.querySelectorAll('[data-fmt]').forEach((b) => b.setAttribute('aria-checked', b.dataset.fmt === this.state.fmt));
        this.querySelectorAll('[data-vps-panel]').forEach((p) => (p.hidden = p.dataset.vpsPanel !== this.state.fmt));

        const price = this.querySelector('[data-vps-price]');
        const label = this.querySelector('[data-vps-price-label]');
        if (price) price.textContent = isSet ? this.t.priceSet : this.t.priceInd;
        if (label) label.textContent = isSet ? this.t.labelSet : this.t.labelInd;

        this.querySelectorAll('.vps-picker').forEach((picker) => {
          const sel = this.sel(picker.dataset.scope);
          if (!sel) return;
          picker.querySelectorAll('.vps-sw').forEach((b) => {
            const c = b.dataset.color;
            const out = this.colorOut(c);
            const on = c === sel.c;
            b.disabled = out;
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-pressed', on);
            b.setAttribute('aria-label', out ? `${c} (${this.t.soldOut})` : c);
          });
          const cname = picker.querySelector('[data-cname]');
          if (cname) cname.textContent = sel.c ?? '';
          picker.querySelectorAll('.vps-sz').forEach((b) => {
            const s = b.dataset.size;
            const out = this.sizeOut(sel.c, s);
            const on = s === sel.s;
            b.disabled = out;
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-pressed', on);
            b.setAttribute('aria-label', out ? `${s} (${this.t.soldOut})` : s);
          });
        });

        this.rows.forEach((row, i) => {
          const sel = this.state.set[i];
          const open = this.state.open === i;
          row.classList.toggle('is-open', open);
          row.querySelector('[data-row-toggle]').setAttribute('aria-expanded', open);
          row.querySelector('.vps-row__body').inert = !open;
          row.querySelector('.vps-row__dot').style.setProperty('--c', this.swatchOf(sel.c));

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

        if (!this.flashing && this.cta && !this.cta.hasAttribute('aria-busy')) {
          this.cta.textContent = isSet ? this.t.ctaSet : this.t.ctaInd;
        }
        if (this.note) this.note.textContent = isSet ? this.t.noteSet : this.t.noteInd;
        this.updateCounter();
      }

      updateCounter() {
        const el = this.querySelector('[data-vps-index]');
        if (!el || !this.track) return;
        const i = Math.round(this.track.scrollLeft / Math.max(this.track.clientWidth, 1));
        el.textContent = String(i + 1);
      }

      goTo(slide) {
        if (!slide || !this.track) return;
        const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.track.scrollTo({ left: slide.offsetLeft, behavior: smooth ? 'smooth' : 'auto' });
      }

      step(dir) {
        const slides = [...this.track.children];
        const i = Math.round(this.track.scrollLeft / Math.max(this.track.clientWidth, 1));
        this.goTo(slides[(i + dir + slides.length) % slides.length]);
      }

      showColor(c) {
        const v = this.data.variants.find((x) => x.c === c && x.m);
        if (v) this.goTo(this.querySelector(`[data-media-id="${v.m}"]`));
      }

      /* ——— Eventos ——— */
      onClick(e) {
        const b = e.target.closest('button');
        if (!b || !this.contains(b)) return;

        if (b.dataset.fmt) {
          this.state.fmt = b.dataset.fmt;
          return this.update();
        }

        if (b.dataset.rowToggle !== undefined) {
          const i = Number(b.dataset.rowToggle);
          this.state.open = this.state.open === i ? -1 : i;
          return this.update();
        }

        const picker = b.closest('.vps-picker');
        if (picker && b.classList.contains('vps-sw')) {
          const sel = this.sel(picker.dataset.scope);
          sel.c = b.dataset.color;
          if (sel.s && this.sizeOut(sel.c, sel.s)) sel.s = null;
          this.showColor(sel.c);
          return this.update();
        }

        if (picker && b.classList.contains('vps-sz')) {
          const scope = picker.dataset.scope;
          this.sel(scope).s = b.dataset.size;
          if (scope !== 'ind') {
            const i = Number(scope);
            const next = i + 1 < this.rows.length ? i + 1 : -1;
            this.state.open = next;
            this.update();
            const head = this.rows[next >= 0 ? next : i].querySelector('[data-row-toggle]');
            head.focus({ preventScroll: true });
            return;
          }
          return this.update();
        }

        if (b.hasAttribute('data-vps-prev')) return this.step(-1);
        if (b.hasAttribute('data-vps-next')) return this.step(1);
        if (b === this.cta) return this.submit();
      }

      async submit() {
        if (this.cta.hasAttribute('aria-busy')) return;
        const isSet = this.state.fmt === 'set';
        const picks = isSet ? this.state.set : [this.state.ind];

        const missing = picks.findIndex((p) => !this.complete(p));
        if (missing >= 0) {
          if (isSet) {
            this.state.open = missing;
            this.update();
            this.note.textContent = this.t.missingRow.replace('[n]', String(missing + 1).padStart(2, '0'));
          } else {
            this.note.textContent = this.t.missingInd;
          }
          return;
        }

        const qty = new Map();
        picks.forEach((p) => {
          const id = this.find(p.c, p.s).id;
          qty.set(id, (qty.get(id) || 0) + 1);
        });
        const body = { items: [...qty].map(([id, quantity]) => ({ id, quantity })) };

        const cart = document.querySelector('cart-drawer') || document.querySelector('cart-notification');
        if (cart && typeof cart.getSectionsToRender === 'function') {
          body.sections = cart.getSectionsToRender().map((s) => s.id);
          body.sections_url = window.location.pathname;
          cart.setActiveElement?.(this.cta);
        }

        this.cta.setAttribute('aria-busy', 'true');
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
            publish(PUB_SUB_EVENTS.cartUpdate, { source: 'vp-set-product', cartData: json });
          }

          if (cart && cart.tagName === 'CART-DRAWER') {
            cart.classList.remove('is-empty');
            cart.renderContents(json);
          } else if (window.routes?.cart_url) {
            window.location = window.routes.cart_url;
            return;
          }

          this.cta.removeAttribute('aria-busy');
          this.flash();
        } catch (err) {
          console.error(err);
          this.note.textContent = this.t.error;
        } finally {
          this.cta.removeAttribute('aria-busy');
        }
      }

      flash() {
        clearTimeout(this.flashing);
        this.cta.textContent = this.t.added;
        this.flashing = setTimeout(() => {
          this.flashing = null;
          this.update();
        }, 2200);
      }
    }
  );
}
