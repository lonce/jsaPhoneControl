/* ---------------------------------------------------------------------------------------
This jsaSound Code is distributed under LGPL 3
Copyright (C) 2012 National University of Singapore
Inquiries: director@anclab.org

This library is free software; you can redistribute it and/or modify it under the terms of the GNU Lesser General Public License as published by the Free Software Foundation; either version 3 of the License, or any later version.
This library is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNULesser General Public License for more details.
You should have received a copy of the GNU General Public License and GNU Lesser General Public License along with this program.  If not, see <http://www.gnu.org/licenses/>
------------------------------------------------------------------------------------------*/
/**
 * A very simple soft realtime message router for the story telling
 * sound rigs project. It uses the ultra simple socket.io library
 * for the message passing and manages connections between two
 * kinds of clients - "synth"s and "controller"s. One or more synths
 * can be connected to one or more controllers and a group of synths
 * and controllers form a "party", with each party given a name.
 *
 * To run this message router, you need Node.js and the socket.io
 * library. 
 *
 * 1. Install Node.js (http://nodejs.org)
 * 2. Install socket.io by running "npm install socket.io" from the
 *    directory from which you'll be running the routing service.
 *    (http://socket.io/)
 * 3. Run the service using "node message-router.js". The service
 *    will run on port 8000, so make sure that port is available.
 * 
 * Note that your synth and controller HTML+JS code needs to connect
 * to the message router that you're running explicitly.
 */

var http = require('http');
var fs = require('fs');

var app = http.createServer(handler);
var io = require('socket.io').listen(app);

app.listen(8000);

var parties = {}; 
// A map from party name to a structure with info on
// the synths and controllers that belong to the party.
 

function handler(req, res) {
    res.end();
}

function partyNamed(name) {
    if (!name) { return undefined; }

    if (name in parties) {
        // Party already exists.
        return parties[name];
    } else {
        // New party name.
        return parties[name] = { name: name, synths: [], controllers: [] };
    }
}

// Avoid verbose logging, which increases the response latency.
io.set('log level', 1);

// Forward messages between controllers and synths belonging to the
// same party.
io.sockets.on('connection', function (socket) {
    // Upon first connection, synths and controllers send a 
    // "register" message of the form {party: "party-name", type: "synth"}
    // for synths and {party: "party-name", type: "controller"} for controllers.
    // Watch for this message and join synths and controllers to their
    // respective parties.
    socket.on('register', function (data) {
        var party = partyNamed(data.party);
        if (party && data.type === 'synth') {
            party.synths.push(socket);
            socket.on('message', make_fwd(party.controllers));
            socket.on('disconnect', make_on_disconnect('Synth', party, party.synths, socket));
            console.log("synth connected");
        } else if (party && data.type === 'control') {
            party.controllers.push(socket);
            socket.on('message', make_fwd(party.synths));
            socket.on('disconnect', make_on_disconnect('Controller', party, party.controllers, socket));
            console.log("controller connected");
        }
    });
});

function make_on_disconnect(type, party, things, socket) {
    return function () {
        var i, N;
        for (i = 0, N = things.length; i < N; ++i) {
            if (things[i] == socket) {
                console.log(type + " " + (i+1) + " in party " + party.name + " disconnected.");
                things.splice(i, 1); // Remove the thing that disconnected.
                return;
            }
        }
    };
}

function make_fwd(targets) {
    return function (data) {
        var i, N;
        for (i = 0, N = targets.length; i < N; ++i) {
            // Just pass the data on. The router doesn't
            // care what the data turns out to be.
            targets[i].send(data);
        }
    };
}
