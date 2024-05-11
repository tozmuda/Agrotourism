import http from "node:http";
import { URL } from "node:url";
import fs from "node:fs";
import path from "node:path";

function requestListener(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET") {
    if (url.pathname === "/") {
      fs.readFile("./index.html", (err, index) => {
        if (err) {
          throw err;
        }
        response.write(index);
        response.end();
      });
    }

    if (url.pathname === "/reservations") {
      fs.readFile("./reservations.html", "utf8", (err, reservations) => {
        if (err) {
          throw err;
        }
        reservations = reservations.replace("{{room1}}", "Hello");
        response.write(reservations);
        response.end();
      });
    }

    if (url.pathname.startsWith("/img/")) {
      fs.readFile("." + url.pathname, (err, data) => {
        if (err) {
          response.writeHead(404, { "Content-Type": "text/plain" });
          response.end("Not Found");
        } else {
          const contentType = getContentType("." + url.pathname);
          response.writeHead(200, { "Content-Type": contentType });
          response.end(data);
        }
      });
    }

    if (url.pathname === "/room") {
      fs.readFile("./rooms.json", (err, data) => {
        if (err) {
          throw err;
        }
        const rooms = JSON.parse(data);
        if (url.searchParams.get("id") != null) {
          rooms.table.forEach((room) => {
            if (room.id == Number(url.searchParams.get("id"))) {
              response.writeHead(200, {
                "Content-Type": "text/plain",
              });
              room.avaliable = isAvailible(room.id);
              response.write(JSON.stringify(room));
              response.end();
            }
          });
        }
      });
    }

    if (url.pathname === "/guest") {
      fs.readFile("./reservations.json", (err, data) => {
        if (err) {
          throw err;
        }
        const reservations = JSON.parse(data);
        fs.readFile("./guests.json", (err, data) => {
          if (err) {
            throw err;
          }
          const guests = JSON.parse(data);
          if (url.searchParams.get("name") != null) {
            let result = [];
            reservations.table.forEach((reservation) => {
              guests.table.forEach((guest) => {
                if (
                  guest.name === url.searchParams.get("name") &&
                  guest.id === reservation.guest_id
                ) {
                  result.push({
                    room_id: reservation.room_id,
                    date1: reservation.date1,
                    date2: reservation.date2,
                  });
                }
              });
            });
            response.writeHead(200, {
              "Content-Type": "text/plain",
            });
            response.write(JSON.stringify(result));
            response.end();
          }
        });
      });
    }
    // else{
    //     response.writeHead(501, { 'Content-Type': 'text/plain; charset=utf-8' });
    //     response.write('Error 501: Not implemented');
    //     response.end();
    // }
  } else if (request.method === "POST") {
    if (url.pathname === "/make_reservation") {
      request.on("data", (data) => {
        const object = JSON.parse(data.toString());
        fs.readFile("./reservations.json", (err, data) => {
          if (err) {
            throw err;  
          }
          let flag = true;
          const reservations = JSON.parse(data);
          let array = reservations.table;
          for (let i = 0; i < array.length; i++) {
            let reservation = array[i];
            let date1 = stringToDate(reservation.date1);
            let date2 = stringToDate(reservation.date2);
            let our_date1 = stringToDate(object.date1);
            let our_date2 = stringToDate(object.date2);

            if (
              object.room_id === reservation.room_id &&
              ((our_date1 >= date1 && our_date1 <= date2) ||
                (our_date2 >= date1 && our_date2 <= date2) ||
                (date1 >= our_date1 && date1 <= our_date2) ||
                (date2 >= our_date1 && date2 <= our_date2))
            )
              flag = false;
          }
          if (flag) {
            reservations.table.push({
              guest_id: object.guest_id,
              room_id: object.room_id,
              date1: object.date1,
              date2: object.date2,
            });
            fs.writeFile(
              "./reservations.json",
              JSON.stringify(reservations),
              (err) => {
                if (err) {
                  console.error("Error writing file:", err);
                  return;
                }
                response.writeHead(200, { "Content-Type": "text/plain" });
                response.end("Rezerwacja zapisana");
              }
            );
          }
          else{
            response.writeHead(200, { "Content-Type": "text/plain" });
            response.end("Pokój zajęty w tym czasie");
          }

        });
      });
    }

    if (url.pathname === "/release_reservation") {
      request.on("data", (data) => {
        const object = JSON.parse(data.toString());
        fs.readFile("./reservations.json", (err, data) => {
          if (err) {
            throw err;
          }
          let flag = true;
          let index;
          const reservations = JSON.parse(data);
          let array = reservations.table;
          for (let i = 0; i < array.length; i++) {
            let reservation = array[i];
            let date1 = stringToDate(reservation.date1);
            let date2 = stringToDate(reservation.date2);
            let our_date1 = stringToDate(object.date1);
            let our_date2 = stringToDate(object.date2);

            if (
              object.room_id === reservation.room_id &&
              object.guest_id === reservation.guest_id &&
              object.date1 === reservation.date1 &&
              object.date2 === reservation.date2
            ){
              flag = false;
              index = i;
            }
          }
          
          if (!flag) {
            reservations.table.splice(index, 1);
            fs.writeFile(
              "./reservations.json",
              JSON.stringify(reservations),
              (err) => {
                if (err) {
                  console.error("Error writing file:", err);
                  return;
                }
                response.writeHead(200, { "Content-Type": "text/plain" });
                response.end("Rezerwacja usunięta");
              }
            );
          } else {
            response.writeHead(200, { "Content-Type": "text/plain" });
            response.end("Nie znaleziono rezerwacji");
          }
        });
      });
    }
  }
}

function getContentType(filePath) {
  const ext = path.extname(filePath);
  switch (ext) {
    case ".jpg":
      return "image/jpeg";
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    default:
      return "application/octet-stream";
  }
}

function isAvailible(room_id) {
  const data = fs.readFileSync("./reservations.json");
  const reservations = JSON.parse(data);
  let now = new Date();
  let array = reservations.table;
  for (let i = 0; i < array.length; i++) {
    let reservation = array[i];
    let date1 = stringToDate(reservation.date1);
    let date2 = stringToDate(reservation.date2);

    if (reservation.room_id == room_id && date1 <= now && now <= date2)
      return false;
  }
  return true;
}

function stringToDate(date) {
  let arr = date.split("-");
  let new_date = new Date(Number(arr[0]), Number(arr[1] - 1), Number(arr[2]));
  return new_date;
}

const server = http.createServer(requestListener);
server.listen(8000);
console.log("The server was started on port 8000");
console.log('To stop the server, press "CTRL + C"');
