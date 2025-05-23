;; Sensor Verification Contract
;; Validates air monitoring devices and ensures they are authorized

(define-data-var admin principal tx-sender)

;; Map to store verified sensors
(define-map verified-sensors
  { sensor-id: (string-utf8 36) }
  {
    owner: principal,
    location: (string-utf8 100),
    sensor-type: (string-utf8 50),
    is-active: bool,
    last-verified: uint
  }
)

;; Public function to register a new sensor
(define-public (register-sensor
                (sensor-id (string-utf8 36))
                (location (string-utf8 100))
                (sensor-type (string-utf8 50)))
  (let ((caller tx-sender))
    (asserts! (not (is-sensor-registered sensor-id)) (err u1))
    (ok (map-set verified-sensors
      { sensor-id: sensor-id }
      {
        owner: caller,
        location: location,
        sensor-type: sensor-type,
        is-active: true,
        last-verified: block-height
      }
    ))
  )
)

;; Public function to deactivate a sensor
(define-public (deactivate-sensor (sensor-id (string-utf8 36)))
  (let ((sensor-data (unwrap! (map-get? verified-sensors { sensor-id: sensor-id }) (err u2)))
        (caller tx-sender))
    (asserts! (or (is-eq caller (var-get admin)) (is-eq caller (get owner sensor-data))) (err u3))
    (ok (map-set verified-sensors
      { sensor-id: sensor-id }
      (merge sensor-data { is-active: false })
    ))
  )
)

;; Public function to reactivate a sensor
(define-public (reactivate-sensor (sensor-id (string-utf8 36)))
  (let ((sensor-data (unwrap! (map-get? verified-sensors { sensor-id: sensor-id }) (err u2)))
        (caller tx-sender))
    (asserts! (or (is-eq caller (var-get admin)) (is-eq caller (get owner sensor-data))) (err u3))
    (ok (map-set verified-sensors
      { sensor-id: sensor-id }
      (merge sensor-data { is-active: true, last-verified: block-height })
    ))
  )
)

;; Read-only function to check if a sensor is registered and active
(define-read-only (is-sensor-active (sensor-id (string-utf8 36)))
  (match (map-get? verified-sensors { sensor-id: sensor-id })
    sensor-data (get is-active sensor-data)
    false
  )
)

;; Read-only function to check if a sensor is registered
(define-read-only (is-sensor-registered (sensor-id (string-utf8 36)))
  (is-some (map-get? verified-sensors { sensor-id: sensor-id }))
)

;; Read-only function to get sensor details
(define-read-only (get-sensor-details (sensor-id (string-utf8 36)))
  (map-get? verified-sensors { sensor-id: sensor-id })
)

;; Function to change admin (only current admin can call)
(define-public (set-admin (new-admin principal))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) (err u4))
    (ok (var-set admin new-admin))
  )
)
