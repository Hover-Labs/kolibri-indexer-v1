FROM node

WORKDIR /app

COPY package.json .

RUN npm i package.json

COPY . .
