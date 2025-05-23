import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Clarity contract environment
const mockContractEnv = () => {
  const state = {
    admin: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
    verifiedSensors: new Map(),
    blockHeight: 100
  };
  
  return {
    state,
    tx: {
      sender: state.admin
    },
    blockHeight: state.blockHeight,
    isEq: (a, b) => a === b,
    mapGet: (map, key) => {
      const keyStr = JSON.stringify(key);
      return map.has(keyStr) ? map.get(keyStr) : null;
    },
    mapSet: (map, key, value) => {
      const keyStr = JSON.stringify(key);
      map.set(keyStr, value);
      return true;
    },
    unwrap: (result, defaultValue) => {
      if (result === null || result === undefined) {
        return defaultValue;
      }
      return result;
    },
    some: (value) => value,
    none: null,
    err: (code) => ({ error: code }),
    ok: (value) => ({ value })
  };
};

// Mock the sensor-verification contract
const mockSensorVerification = (env) => {
  return {
    registerSensor: (sensorId, location, sensorType) => {
      if (env.mapGet(env.state.verifiedSensors, { sensorId })) {
        return env.err(1); // Sensor already registered
      }
      
      env.mapSet(env.state.verifiedSensors, { sensorId }, {
        owner: env.tx.sender,
        location,
        sensorType,
        isActive: true,
        lastVerified: env.blockHeight
      });
      
      return env.ok(true);
    },
    
    deactivateSensor: (sensorId) => {
      const sensor = env.mapGet(env.state.verifiedSensors, { sensorId });
      if (!sensor) {
        return env.err(2); // Sensor not found
      }
      
      if (env.tx.sender !== env.state.admin && env.tx.sender !== sensor.owner) {
        return env.err(3); // Not authorized
      }
      
      sensor.isActive = false;
      env.mapSet(env.state.verifiedSensors, { sensorId }, sensor);
      
      return env.ok(true);
    },
    
    reactivateSensor: (sensorId) => {
      const sensor = env.mapGet(env.state.verifiedSensors, { sensorId });
      if (!sensor) {
        return env.err(2); // Sensor not found
      }
      
      if (env.tx.sender !== env.state.admin && env.tx.sender !== sensor.owner) {
        return env.err(3); // Not authorized
      }
      
      sensor.isActive = true;
      sensor.lastVerified = env.blockHeight;
      env.mapSet(env.state.verifiedSensors, { sensorId }, sensor);
      
      return env.ok(true);
    },
    
    isSensorActive: (sensorId) => {
      const sensor = env.mapGet(env.state.verifiedSensors, { sensorId });
      return sensor ? sensor.isActive : false;
    },
    
    isSensorRegistered: (sensorId) => {
      return env.mapGet(env.state.verifiedSensors, { sensorId }) !== null;
    },
    
    getSensorDetails: (sensorId) => {
      return env.mapGet(env.state.verifiedSensors, { sensorId });
    },
    
    setAdmin: (newAdmin) => {
      if (env.tx.sender !== env.state.admin) {
        return env.err(4); // Not authorized
      }
      
      env.state.admin = newAdmin;
      return env.ok(true);
    }
  };
};

describe('Sensor Verification Contract', () => {
  let env;
  let contract;
  
  beforeEach(() => {
    env = mockContractEnv();
    contract = mockSensorVerification(env);
  });
  
  it('should register a new sensor', () => {
    const result = contract.registerSensor('sensor-123', 'Downtown', 'PM2.5');
    
    expect(result).toEqual({ value: true });
    expect(contract.isSensorRegistered('sensor-123')).toBe(true);
    expect(contract.isSensorActive('sensor-123')).toBe(true);
    
    const sensorDetails = contract.getSensorDetails('sensor-123');
    expect(sensorDetails).toEqual({
      owner: env.state.admin,
      location: 'Downtown',
      sensorType: 'PM2.5',
      isActive: true,
      lastVerified: env.blockHeight
    });
  });
  
  it('should not register a sensor with an existing ID', () => {
    contract.registerSensor('sensor-123', 'Downtown', 'PM2.5');
    const result = contract.registerSensor('sensor-123', 'Uptown', 'CO2');
    
    expect(result).toEqual({ error: 1 });
  });
  
  it('should deactivate a sensor', () => {
    contract.registerSensor('sensor-123', 'Downtown', 'PM2.5');
    const result = contract.deactivateSensor('sensor-123');
    
    expect(result).toEqual({ value: true });
    expect(contract.isSensorActive('sensor-123')).toBe(false);
  });
  
  it('should reactivate a sensor', () => {
    contract.registerSensor('sensor-123', 'Downtown', 'PM2.5');
    contract.deactivateSensor('sensor-123');
    
    env.blockHeight = 200; // Simulate time passing
    
    const result = contract.reactivateSensor('sensor-123');
    
    expect(result).toEqual({ value: true });
    expect(contract.isSensorActive('sensor-123')).toBe(true);
    
    const sensorDetails = contract.getSensorDetails('sensor-123');
    expect(sensorDetails.lastVerified).toBe(200);
  });
  
  it('should not allow unauthorized users to deactivate sensors', () => {
    contract.registerSensor('sensor-123', 'Downtown', 'PM2.5');
    
    // Change the sender
    env.tx.sender = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
    
    const result = contract.deactivateSensor('sensor-123');
    expect(result).toEqual({ error: 3 });
    expect(contract.isSensorActive('sensor-123')).toBe(true);
  });
  
  it('should allow changing the admin', () => {
    const newAdmin = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
    const result = contract.setAdmin(newAdmin);
    
    expect(result).toEqual({ value: true });
    expect(env.state.admin).toBe(newAdmin);
  });
  
  it('should not allow non-admin to change admin', () => {
    env.tx.sender = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
    const result = contract.setAdmin('ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5NH2B6RSA');
    
    expect(result).toEqual({ error: 4 });
  });
});
