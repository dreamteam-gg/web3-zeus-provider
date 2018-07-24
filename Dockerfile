FROM node:10
WORKDIR /web3-zeus-provider
COPY . /web3-zeus-provider
RUN npm install