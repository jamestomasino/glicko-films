help:
	@echo "targets:"
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	| sed -n 's/^\(.*\): \(.*\)##\(.*\)/  \1|\3/p' \
	| column -t  -s '|'

environment: ## which environment is running in which mode?
	@if [ "3000" = "$$(grep "127.0.0.1" /etc/nginx/sites-available/production | sed "s/^.*://" | sed "s/;.*$$//")" ]; then \
		printf "Production: serva\\n"; \
	else \
		printf "Production: servb\\n"; \
	fi

production: ## update the latest code and build production environment
	@if [ "3000" = "$$(grep "127.0.0.1" /etc/nginx/sites-available/production | sed "s/^.*://" | sed "s/;.*$$//")" ]; then \
		$(MAKE) serva; \
	else \
		$(MAKE) servb; \
	fi

stage: ## update the latest code and build stage environment
	@if [ "3000" = "$$(grep "127.0.0.1" /etc/nginx/sites-available/production | sed "s/^.*://" | sed "s/;.*$$//")" ]; then \
		$(MAKE) servb; \
	else \
		$(MAKE) serva; \
	fi

serva:
	cd "./serva"; \
	git reset --hard HEAD; \
	git pull; \
	git lfs pull; \
	yarn; \
	yarn build
	$$HOME/.npm-packages/bin/pm2 startOrRestart ecosystem.config.js --only serva

servb:
	cd "./servb"; \
	git reset --hard HEAD; \
	git pull; \
	git lfs pull; \
	yarn; \
	yarn build
	$$HOME/.npm-packages/bin/pm2 startOrRestart ecosystem.config.js --only servb

swap-env: ## reverse stage and production environments in nginx
	@if [ "3000" = "$$(grep "127.0.0.1" /etc/nginx/sites-available/production | sed "s/^.*://" | sed "s/;.*$$//")" ]; then \
		sudo sed -i"" -e 's/3000/4000/' /etc/nginx/sites-available/production; \
		sudo sed -i"" -e 's/4000/3000/' /etc/nginx/sites-available/stage; \
		sudo systemctl reload nginx; \
	else \
		sudo sed -i"" -e 's/4000/3000/' /etc/nginx/sites-available/production; \
		sudo sed -i"" -e 's/3000/4000/' /etc/nginx/sites-available/stage; \
		sudo systemctl reload nginx; \
	fi

.PHONY: help environment serva servb swap-env production stage
