CREATE TABLE schema_version (
  version INTEGER,
  comment TEXT NOT NULL,
  time TIMESTAMP
);

INSERT INTO schema_version (version, comment, time)
VALUES (0, '', NULL);

CREATE TABLE user (
  id INT NOT NULL AUTO_INCREMENT,
  email VARCHAR(64) UNIQUE NOT NULL,
  password VARCHAR(64) NOT NULL,
  salt VARCHAR(64) NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE session (
  id INT NOT NULL AUTO_INCREMENT,
  hash VARCHAR(64) NOT NULL,
  user_id INT,
  created_at TIMESTAMP NOT NULL,
  FOREIGN KEY (user_id) REFERENCES user (id),
  PRIMARY KEY (id)
);

CREATE TABLE job (
  id INT NOT NULL AUTO_INCREMENT,
  title VARCHAR(64) NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE shift (
  id INT NOT NULL AUTO_INCREMENT,
  in_time TIMESTAMP NOT NULL,
  out_time TIMESTAMP,
  job_id INT NOT NULL,
  user_id INT NOT NULL,
  memo TEXT,
  FOREIGN KEY (job_id) REFERENCES job (id),
  FOREIGN KEY (user_id) REFERENCES user (id),
  PRIMARY KEY (id)
);

CREATE TABLE payroll (
  pay_time TIMESTAMP NOT NULL,
  job_id INT NOT NULL,
  user_id INT NOT NULL,
  FOREIGN KEY (job_id) REFERENCES job (id),
  FOREIGN KEY (user_id) REFERENCES user (id)
);
