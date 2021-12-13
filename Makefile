build-docker-image:
	docker build -t kolibri-watcher .

bash:
	docker run --rm -it -v $$(pwd):/shared --workdir /shared -p 9229:9229 kolibri-watcher bash

run:
	docker run --rm -it -v $$(pwd):/shared --init --workdir /shared -p 9229:9229 kolibri-watcher npx ts-node src/main.ts

debug:
	docker run -e TEST=1 --rm -it -v $$(pwd):/shared --init --workdir /shared -p 9229:9229 kolibri-watcher node --inspect-brk=0.0.0.0 -r ts-node/register src/main.ts
