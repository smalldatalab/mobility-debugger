
google.load("visualization", "1", {packages:["timeline", "map"]});

function drawDate(username, date, device){
    $.ajax({
        type: 'GET',
        url: dsu + "dataPoints/"+getDatapointId(username, date, device),
        headers: {
            "Authorization": "Bearer " + token
        },
        success : function(data) {
            console.log(data);
            drawChart(data,device)
        },
        error: function(data){
            $("#map, #timeline").html("No mobility data for " + device);
        }

    });
}
function drawChart(data, device) {
    var container = document.getElementById('timeline');
    var chart = new google.visualization.Timeline(container);
    var dataTable = new google.visualization.DataTable();

    dataTable.addColumn({ type: 'string', id: 'State' });
    dataTable.addColumn({ type: 'date', id: 'Start' });
    dataTable.addColumn({ type: 'date', id: 'End' });
    var rows, locationData;
    if(device == "android" || device == "ios") {
        rows = data["body"]["episodes"].map(function (epi) {
            var state = epi["inferred-state"].toLocaleUpperCase();
            var start = new Date(epi["start"]);
            var end = new Date(epi["end"]);
            return [state, start, end];
        });
        locationData = data["body"]["episodes"].map(function(epi){
            return epi["location-samples"];
        });
    }else if (device == "moves-app"){
        // create a new data object for Moves where each entry correspond to a row
        locationData = [];
        rows = [];
        data["body"]["segments"].forEach(function (segment) {
            if(segment.type == "place"){
                // create a STILL entry if the current Moves segment type is place
                var state = "PLACE";
                var start = moment((segment["startTime"]), "YYYYMMDDTHHmmssZ").toDate();
                var end = moment((segment["endTime"]), "YYYYMMDDTHHmmssZ").toDate();
                rows.push([state, start, end]);

                // add the place's location to the data and use the segment start time as the time of that location
                if(segment.place.location){
                    segment.place.location.time = segment["startTime"];
                    locationData.push([segment.place.location])
                }else{
                    locationData.push([]);
                }
            }
            if( segment["activities"]) {
                segment["activities"].forEach(function (a) {
                    // create an entry for each activity
                    var state = a["group"].toLocaleUpperCase();
                    var start = moment((a["startTime"]), "YYYYMMDDTHHmmssZ").toDate();
                    var end = moment((a["endTime"]), "YYYYMMDDTHHmmssZ").toDate();
                    rows.push([state, start, end]);
                    // add tracking points to the data object
                    if (a.trackPoints) {
                        locationData.push(a.trackPoints);
                    } else {
                        locationData.push([]);
                    }
                });
            }
        });
    }
    if(locationData.length != rows.length) {
        console.error("locationData.length != rows.length");
    }else {
        dataTable.addRows(rows);
        chart.draw(dataTable, {chartArea: {width: '100%', height:'100%'}});
        google.visualization.events.addListener(chart, 'select', function selectHandler() {
            drawMap(locationData, chart.getSelection()[0]["row"], device);
        });
        drawMap(locationData, -1, device);
    }

}
function showSummary(username, date, device) {
    $.ajax({
        type: 'GET',
        url: dsu + "dataPoints/"+getSummaryDatapointId(username, date, device),
        headers: {
            "Authorization": "Bearer " + token
        },
        success : function(data) {
            console.log(data);
            $("#walking-distance").html((data.body["walking_distance_in_km"]*0.621371192).toFixed(2) + " miles");
            $("#walking-time").html(moment.duration(data.body["active_time_in_seconds"], 'seconds').humanize());
            $("#max-gait").html(data.body["max_gait_speed_in_meter_per_second"].toFixed(2) + " m/sec");
            $("#geodiameter").html((data.body["geodiameter_in_km"]*0.621371192).toFixed(2) + " miles");



        },
        error: function(data){
            $("#walking-distance, #walking-time").html("No data");
        }

    });
}
function drawMap(dat, row, device) {
    var locations = [
        ['Lat', 'Long', 'Name']
    ];
    if(device == "android" || device == "ios") {
        if (row >= 0) {
            var epi = dat[row];
            locations = locations.concat(epi.map(function (loc) {
                return [loc.latitude, loc.longitude, moment(loc.timestamp).format('h:mm:ss a')];
            }));


        } else {
            dat.forEach(function (epi) {
                locations = locations.concat(epi.slice(0, 1).map(function (loc) {
                    return [loc.latitude, loc.longitude, moment(loc.timestamp).format('h:mm:ss a')];
                }));
            })
        }
    }else if(device == "moves-app"){
        if (row >= 0) {
            locations = locations.concat(dat[row].map(function (loc) {
                return [loc.lat, loc.lon, moment(loc.time, "YYYYMMDDTHHmmssZ").format('h:mm:ss a')];
            }));


        } else {
            dat.forEach(function (seg) {
                locations = locations.concat(seg.slice(0, 1).map(function (loc) {
                    return [loc.lat, loc.lon, moment(loc.time, "YYYYMMDDTHHmmssZ").format('h:mm:ss a')];
                }));
            })
        }
    }
    var rows = google.visualization.arrayToDataTable(locations);

    var options = {
        chartArea: {width: '100%', height:'100%'},
        showTip: true };

    var map = new google.visualization.Map(document.getElementById('map'));

    map.draw(rows, options);
}