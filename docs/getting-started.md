
## Quick Start 🚀

```sh
# Run default tests (allocation algorithm)
./run-tests.sh

# Run specific test categories
./run-tests.sh all           # All unit tests
./run-tests.sh integration   # Integration tests
./run-tests.sh performance   # Performance tests
./run-tests.sh security      # Security tests
./run-tests.sh errors        # Error handling tests
./run-tests.sh edge-cases    # Edge case tests
```

## TypeScript Interface Definition

Aka, IDL file: `types/reset_program.ts`

```typescript                                                                     
// Platform initialization                                                        
program.methods.initialize()                                                      
                                                                                  
// Auction management                                                             
program.methods.initAuction(commitStartTime, commitEndTime, claimStartTime, bins) 
program.methods.setPrice(binId, newPrice)                                         
                                                                                  
// User interactions                                                              
program.methods.commit(binId, paymentTokenCommitted)                              
program.methods.revertCommit(paymentTokenReverted)                                
program.methods.claim()                                                           
program.methods.claimAmount(saleTokenToClaim)                                     
                                                                                  
// Admin functions                                                                
program.methods.withdrawFunds(binId)                                              
program.methods.withdrawFees(binId)                                               
``
