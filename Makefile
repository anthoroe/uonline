all:
	# No. Specify a target.


compress:
	./compress-templates.sh

pull:
	git pull origin master

killcache:
	# we cannot delete templates_cache, so we just move it to /tmp
	mkdir -p /tmp/killme
	mv templates_cache /tmp/killme/`mcookie`

dirs:
	mkdir -p templates_cache
	chmod 777 -R templates_cache
	mkdir -p templates

diagnose:
	php composer.phar diagnose
	php composer.phar validate

check:
	RESULT='Everything is OK.'; for i in `find -name "*.js" | grep -v ./node_modules/ | grep -v ./bootstrap/ | grep -v ./code-coverage-report/ | grep -v ./vendor/`; do if `which test` 'y' "==" 'y'"`cat $$i | egrep "^['\\"]use strict['\\"];"`"; then echo 'Non-strict:' $$i; RESULT='There are some non-strict files.'; else echo 'Strict:' $$i; fi; done; echo $$RESULT

test:
	./node_modules/nodeunit/bin/nodeunit tests_node/ --reporter verbose
	php vendor/bin/phpunit --strict --verbose --colors --coverage-html ./code-coverage-report tests/

testl:
	./node_modules/nodeunit/bin/nodeunit tests_node/ --reporter verbose
	php vendor/bin/phpunit --strict --verbose tests/

deploy: pull killcache dirs compress diagnose test

serve:
	php -S localhost:8080 -t .
