# CrowdMixer: Differentially Private Anonymous Communication


# Introduction
In the era of mass surveillance, there is a growing need for anonymous communications systems. Even if the content of anonymous messages is encrypted, adversaries can learn information through metadata such as who they are communicating with, the size of the messages, and the time of communication. The leakage of metadata itself compromises user privacy, posing a problem to individuals who require complete anonymity such as government whistleblowers and activists under repressive regimes. 

Previous anonymous communications systems such as Vuvuzela¹ and Karaoke² are able to hide metadata, tolerate compromised servers, achieve scalability, and deliver messages with good latency. However, they still face two limitations: First, oftentimes the number of users of an ACN is very small, which makes connecting to the system inherently suspicious and less anonymous. Second, these systems only allow for ephemeral messages that are not retrievable over time. CrowdMixer aims to expand upon existing protocols to address these two challenges. The privacy guarantee can be quantified using the concept of differential privacy, which utilizes the parameters ε and δ. A low ε and δ indicates a higher standard of privacy for a user. 

# Composition
CrowdMixer, which operates on discrete rounds each hour, is composed of entry servers, mixnet servers, and a mailbox server. For one active user to communicate with another active user, they must have a shared secret key. During the start of a round, both active users hash to an address in the mailbox server based on the shared secret key and the round number. Then, the messages are onion encrypted and sent to the entry servers. The entry servers generate fake noise messages (based off of the Laplace and Poisson distributions) and perform a random shuffle of the message order before sending them to the mixnet servers, which add more noise and perform another shuffle. Finally, the messages arrive at the mailbox server where the messages are exchanged and sent back down the chain. Active users then connect to the entry servers later in the hour to get their messages back.

If a user is attempting to retrieve messages from past rounds, they must hash to mailbox addresses using the shared secret and past round numbers, with the limitation that past messages are deleted after 6 hours of storage. 

Passive users use the chrome extension to generate noise messages and mailbox numbers, which are then sent to the entry servers as long as the passive user has a chrome instance open. These messages are indistinguishable from active user messages. 

# Instructions: 
Read this after cloning the repository. 

# Mixnet:
First, install all dependencies in the CrowdMixer folder using ‘npm install’

Second, to run the Mixnet, use command npm run dev

This will concurrently start all 5 servers

# sendMessage.js File
To simulate an active user, simply run “node sendMessage.js” after the mixnet as been started, and wait for an hour

# Chrome Extension
This is a demo extension, so you can load the chrome extension the via chrome://extensions/

After uploading the extension, simply enable it and if the mixnet is on, it will generate cover traffic 

