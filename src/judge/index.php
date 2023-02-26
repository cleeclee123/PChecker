<?php
// from https://github.com/cleeclee123/azenv/blob/main/index.php

##########################################################################
#	
#	AZ Environment variables 1.04 © 2004 AZ
#	Civil Liberties Advocacy Network
#	http://clan.cyaccess.com   http://clanforum.cyaccess.com
#	
#	AZenv is written in PHP & Perl. It is coded to be simple,
#	fast and have negligible load on the server.
#	AZenv is primarily aimed for programs using external scripts to
#	verify the passed Environment variables.
#	Only the absolutely necessary parameters are included.
#	AZenv is free software; you can use and redistribute it freely.
#	Please do not remove the copyright information.
#
##########################################################################

// original azenv.php logic
// foreach ($_SERVER as $header => $value) {
// 	if (
// 		strpos($header, 'REMOTE') !== false || strpos($header, 'HTTP') !== false ||
// 		strpos($header, 'REQUEST') !== false
// 	) {
// 		echo $header . ' = ' . $value . "\n";
// 	}
// }

// Additions/Modifications Below:

/**
 *  An example CORS-compliant method.  It will allow any GET, POST, or OPTIONS requests from any
 *  origin.
 *
 *  In a production environment, you probably want to be more restrictive, but this gives you
 *  the general idea of what is involved.  For the nitty-gritty low-down, read:
 *
 *  - https://developer.mozilla.org/en/HTTP_access_control
 *  - https://fetch.spec.whatwg.org/#http-cors-protocol
 * 
 * Reference: https://stackoverflow.com/questions/8719276/cross-origin-request-headerscors-with-php-headers
 */
function cors()
{
	// Allow from any origin
	if (isset($_SERVER['HTTP_ORIGIN'])) {
		// Decide if the origin in $_SERVER['HTTP_ORIGIN'] is one
		// you want to allow, and if so:
		header("Access-Control-Allow-Origin: {$_SERVER['HTTP_ORIGIN']}");
		header('Access-Control-Allow-Credentials: true');
		header('Access-Control-Max-Age: 86400');    // cache for 1 day
	}

	// Access-Control headers are received during OPTIONS requests
	if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {

		if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_METHOD']))
			// may also be using PUT, PATCH, HEAD etc
			header("Access-Control-Allow-Methods: GET, POST, OPTIONS");

		if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']))
			header("Access-Control-Allow-Headers: {$_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']}");

		exit(0);
	}
}

/**
 * Get all HTTP header key/values as an associative array for the current request.
 * Reference: https://github.com/ralouphie/getallheaders
 * 
 * @return string[string] The HTTP header key/value pairs.
 */
function getHeaders()
{
	$headers = array();

	$copy_server = array(
		'CONTENT_TYPE'   => 'Content-Type',
		'CONTENT_LENGTH' => 'Content-Length',
		'CONTENT_MD5'    => 'Content-Md5',
	);

	foreach ($_SERVER as $key => $value) {
		if (strpos($key, 'REMOTE') !== false || strpos($key, 'HTTP') !== false || strpos($key, 'REQUEST') !== false) {
			$key = str_replace(['REMOTE_', 'HTTP_', 'REQUEST_'], "", $key);
			if (!isset($copy_server[$key]) || !isset($_SERVER[$key])) {
				$headers[$key] = $value;
			}
		} elseif (isset($copy_server[$key])) {
			$headers[$copy_server[$key]] = $value;
		}
	}

	if (!isset($headers['Authorization'])) {
		if (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
			$headers['Authorization'] = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
		} elseif (isset($_SERVER['PHP_AUTH_USER'])) {
			$basic_pass = isset($_SERVER['PHP_AUTH_PW']) ? $_SERVER['PHP_AUTH_PW'] : '';
			$headers['Authorization'] = 'Basic ' . base64_encode($_SERVER['PHP_AUTH_USER'] . ':' . $basic_pass);
		} elseif (isset($_SERVER['PHP_AUTH_DIGEST'])) {
			$headers['Authorization'] = $_SERVER['PHP_AUTH_DIGEST'];
		}
	}

	return $headers;
}

// enable cors 
cors();
header('Content-Type: application/json; charset=utf-8');

$errorObj = (object) [
  'auth' => "not authorized",
];

// basic username and pass auth
if (!isset($_SERVER [ 'PHP_AUTH_USER'] )) {
  header("WWW-Authenticate: Basic realm=\"Private Area\"");
  header("HTTP/1.0 401 Unauthorized");
  echo json_encode($errorObj);
  exit;
} else {
  // basic username and pass auth
  if (($_SERVER [ 'PHP_AUTH_USER'] == "username goes here") && ($_SERVER [ 'PHP_AUTH_PW'] == "password goes here"))  {
    $sucessObj = (object) [
      'auth' => "authorized",
      'name' => $_SERVER [ 'PHP_AUTH_USER'],
			'res' => getHeaders(),
    ];

    // to json
    echo json_encode($sucessObj);
  } else {
    header("WWW-Authenticate: Basic realm=\"Private Area\"");
    header("HTTP/1.0 401 Unauthorized");
    
    // to json
    echo json_encode($errorObj);
  }
}
?>