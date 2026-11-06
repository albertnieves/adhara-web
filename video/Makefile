# Flujo completo de un clip: make clip SLUG=<slug>
# Cada objetivo es una etapa (`npm run <etapa>`), idempotente, con su salida en
# build/<slug>/<etapa>/. Las etapas sin implementar fallan con un aviso y paran
# el flujo: nunca se simula un resultado.

SLUG ?= ejemplo
RUN = npm run --silent

STAGES = tokens storyboard fonts icons prompts comfy ltx svg motion three remotion audio review

.NOTPARALLEL:
.PHONY: clip doctor test typecheck $(STAGES)

clip: $(STAGES)
	@echo "✓ Clip listo: build/$(SLUG)/final.mp4 · informe: review/$(SLUG).md"

$(STAGES):
	@echo "→ $@ ($(SLUG))"
	@$(RUN) $@ -- --slug $(SLUG)

doctor:
	@$(RUN) doctor

test:
	@$(RUN) test

typecheck:
	@$(RUN) typecheck
